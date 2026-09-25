import { DateTime } from "luxon";
import { z } from "zod";
import type { DateRange, ExtractionBatch, ExtractedShowtime, VenueSlug } from "../contracts.js";
import { extractedShowtimeSchema } from "../contracts.js";
import { fetchJson } from "../http.js";
import { iso, mapWithConcurrency, TORONTO_TZ } from "./utils.js";

/**
 * Cinéma Beaubien, Cinéma du Parc and Cinéma du Musée publish one schedule on
 * cinemacinema.ca, a SvelteKit site. The schedule route's `__data.json` carries
 * every screening for one calendar day and the list of days with screenings, so
 * the three venues share one crawl and split its output by `cinema_id`. Tickets
 * are sold on each cinema's own billetterie host.
 */
export interface CinemaCinemaVenue {
  venueSlug: VenueSlug;
  /** `cinema_id` in the schedule payload and `P2` in ticket links. */
  cinemaId: number;
  ticketBaseUrl: string;
}

export const CINEMA_BEAUBIEN: CinemaCinemaVenue = { venueSlug: "cinema-beaubien", cinemaId: 1, ticketBaseUrl: "https://billetterie.cinemabeaubien.com" };
export const CINEMA_DU_PARC: CinemaCinemaVenue = { venueSlug: "cinema-du-parc", cinemaId: 2, ticketBaseUrl: "https://billetterie.cinemaduparc.com" };
export const CINEMA_DU_MUSEE: CinemaCinemaVenue = { venueSlug: "cinema-du-musee", cinemaId: 3, ticketBaseUrl: "https://billetterie.cinemadumusee.com" };
export const CINEMACINEMA_VENUES = [CINEMA_BEAUBIEN, CINEMA_DU_PARC, CINEMA_DU_MUSEE] as const;

const BASE = "https://cinemacinema.ca";
const SCHEDULE_DATA = "/en/schedule/__data.json";
/** The site lists about two months of dates; more than this means the list is not what we think it is. */
const MAX_DATES = 120;
/** Three venues ask for the same crawl within one ingest; keep it for that long. */
const SHARED_CRAWL_TTL_MS = 10 * 60_000;

// ---- SvelteKit data payload ----------------------------------------------------

/**
 * SvelteKit serialises route data with devalue: each node's `data` is a flat array
 * where objects and arrays hold indexes into that array and negative numbers stand
 * for special values. This rebuilds the plain value; it covers the shapes a
 * schedule can hold and passes anything exotic through unchanged.
 */
export function decodeDevalue(values: unknown[]): unknown {
  const hydrated = new Map<number, unknown>();

  const hydrate = (index: number): unknown => {
    if (index === -1) return undefined;
    if (index === -3) return Number.NaN;
    if (index === -4) return Number.POSITIVE_INFINITY;
    if (index === -5) return Number.NEGATIVE_INFINITY;
    if (index === -6) return -0;
    if (hydrated.has(index)) return hydrated.get(index);
    const value = values[index];

    if (Array.isArray(value)) {
      if (typeof value[0] === "string" && value.length > 1 && ["Date", "Set", "Map", "RegExp", "Object", "null", "BigInt"].includes(value[0])) {
        const tag = value[0];
        if (tag === "Date") { const date = new Date(value[1] as string); hydrated.set(index, date); return date; }
        if (tag === "Set") { const set = new Set<unknown>(); hydrated.set(index, set); (value.slice(1) as number[]).forEach((item) => set.add(hydrate(item))); return set; }
        if (tag === "Map") {
          const map = new Map<unknown, unknown>(); hydrated.set(index, map);
          for (let i = 1; i < value.length; i += 2) map.set(hydrate(value[i] as number), hydrate(value[i + 1] as number));
          return map;
        }
        if (tag === "null") {
          const object: Record<string, unknown> = {}; hydrated.set(index, object);
          for (let i = 1; i < value.length; i += 2) object[value[i] as string] = hydrate(value[i + 1] as number);
          return object;
        }
        if (tag === "RegExp") { const regexp = new RegExp(value[1] as string, value[2] as string | undefined); hydrated.set(index, regexp); return regexp; }
        if (tag === "Object") { const wrapped = value[1]; hydrated.set(index, wrapped); return wrapped; }
        if (tag === "BigInt") { const big = BigInt(value[1] as string); hydrated.set(index, big); return big; }
      }
      const array: unknown[] = [];
      hydrated.set(index, array);
      (value as number[]).forEach((item) => array.push(item === -2 ? undefined : hydrate(item)));
      return array;
    }

    if (value && typeof value === "object") {
      const object: Record<string, unknown> = {};
      hydrated.set(index, object);
      for (const [key, item] of Object.entries(value as Record<string, number>)) object[key] = hydrate(item);
      return object;
    }

    hydrated.set(index, value);
    return value;
  };

  return hydrate(0);
}

const dataNodeSchema = z.object({ type: z.literal("data"), data: z.array(z.unknown()) });
const dataDocumentSchema = z.object({ type: z.literal("data"), nodes: z.array(z.unknown()) });

/** Decode every data node of a `__data.json` response; skipped or error nodes become `undefined`. */
export function decodeSvelteKitData(payload: unknown): unknown[] {
  const document = dataDocumentSchema.safeParse(payload);
  if (!document.success) throw new Error("response is not a SvelteKit data document");
  return document.data.nodes.map((node) => {
    const parsed = dataNodeSchema.safeParse(node);
    return parsed.success ? decodeDevalue(parsed.data.data) : undefined;
  });
}

// ---- Schedule payload ---------------------------------------------------------

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}/);

const representationSchema = z.object({
  representation_id: z.number().int(),
  cinema_id: z.number().int(),
  film_id: z.number().int(),
  titre: z.string().optional().default(""),
  representation_date: isoDay,
  heure_debut: z.string().min(1),
  version: z.string().optional().default(""),
  format: z.string().optional().default(""),
  salle: z.union([z.number(), z.string()]).optional(),
  salle_desc: z.string().optional().default(""),
  url_bel: z.boolean().optional().default(true),
  url_autre_bel: z.string().optional().default(""),
});

const filmSchema = z.object({
  film_id: z.number().int(),
  cinema_id: z.number().int(),
  titre: z.string().min(1),
  version: z.string().optional().default(""),
  slug: z.string().optional().default(""),
  representations: z.array(z.unknown()),
});

const scheduleNodeSchema = z.object({
  filmsRepresentations: z.array(z.unknown()),
  datesRepresentations: z.array(isoDay).optional().default([]),
});

export interface ParsedSchedule {
  /** Every screening on the page, for all three cinemas. */
  showtimes: ExtractedShowtime[];
  /** Calendar days (YYYY-MM-DD) the site has screenings for. */
  dates: string[];
  warnings: string[];
}

function issues(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".") || "value"} ${issue.message}`).join("; ");
}

function venueFor(cinemaId: number): CinemaCinemaVenue | undefined {
  return CINEMACINEMA_VENUES.find((venue) => venue.cinemaId === cinemaId);
}

/** Ticket links follow the pattern the schedule page prints: `P2` is the cinema, `P3` the screening. */
export function ticketUrl(venue: CinemaCinemaVenue, representationId: number): string {
  return `${venue.ticketBaseUrl}/US/movie-purchase.awp?P1=01&P2=${String(venue.cinemaId).padStart(2, "0")}&P3=${representationId}`;
}

/** Parse one `__data.json` response. A malformed film or screening is reported and skipped. */
export function parseCinemaCinemaSchedule(payload: unknown): ParsedSchedule {
  const nodes = decodeSvelteKitData(payload);
  const node = nodes.map((candidate) => scheduleNodeSchema.safeParse(candidate)).find((result) => result.success)?.data;
  if (!node) throw new Error("no schedule node in the response");

  const showtimes: ExtractedShowtime[] = [];
  const warnings: string[] = [];

  node.filmsRepresentations.forEach((entry, filmIndex) => {
    const film = filmSchema.safeParse(entry);
    if (!film.success) {
      warnings.push(`film ${filmIndex}: ${issues(film.error)}`);
      return;
    }
    const detailUrl = film.data.slug ? `${BASE}/en/films/${film.data.slug}` : `${BASE}/en/schedule`;

    film.data.representations.forEach((raw, index) => {
      const representation = representationSchema.safeParse(raw);
      if (!representation.success) {
        warnings.push(`film ${film.data.film_id} screening ${index}: ${issues(representation.error)}`);
        return;
      }
      const row = representation.data;
      const venue = venueFor(row.cinema_id);
      if (!venue) {
        warnings.push(`screening ${row.representation_id}: unknown cinema_id ${row.cinema_id}`);
        return;
      }
      const startsAt = DateTime.fromFormat(`${row.representation_date.slice(0, 10)} ${row.heure_debut.trim()}`, "yyyy-MM-dd h:mm a", { zone: TORONTO_TZ, locale: "en-CA" });
      if (!startsAt.isValid) {
        warnings.push(`screening ${row.representation_id}: unreadable time "${row.representation_date} ${row.heure_debut}"`);
        return;
      }
      const version = (row.version || film.data.version).trim();
      const format = row.format.trim();
      const ticket = row.url_bel ? ticketUrl(venue, row.representation_id) : row.url_autre_bel.trim() || undefined;

      const showtime = extractedShowtimeSchema.safeParse({
        venueSlug: venue.venueSlug,
        sourceUid: String(row.representation_id),
        rawTitle: film.data.titre.trim(),
        startsAt: iso(startsAt),
        detailUrl,
        ...(ticket ? { ticketUrl: ticket } : {}),
        tags: [version, format && !/^2d$/i.test(format) ? format : ""].filter(Boolean),
        sourcePayload: { filmId: film.data.film_id, cinemaId: row.cinema_id, screeningTitle: row.titre, version, format, room: row.salle, slug: film.data.slug },
      });
      if (!showtime.success) {
        warnings.push(`screening ${row.representation_id}: ${issues(showtime.error)}`);
        return;
      }
      showtimes.push(showtime.data);
    });
  });

  return { showtimes, dates: node.datesRepresentations.map((date) => date.slice(0, 10)), warnings };
}

// ---- Crawl ----------------------------------------------------------------------

interface SharedCrawl {
  showtimes: ExtractedShowtime[];
  warnings: string[];
  fetchedAt: string;
}

function localDay(date: Date): string {
  const value = DateTime.fromJSDate(date).setZone(TORONTO_TZ).toISODate();
  if (!value) throw new Error(`Invalid date: ${String(date)}`);
  return value;
}

/** One request for today's page and its date list, then one request per further day inside the range. */
export async function crawlCinemaCinema(range: DateRange): Promise<SharedCrawl> {
  const first = await fetchJson(new URL(SCHEDULE_DATA, BASE));
  const today = parseCinemaCinemaSchedule(first);
  const warnings = [...today.warnings];
  const seen = new Set(today.showtimes.map((showtime) => showtime.sourceUid));
  const showtimes = [...today.showtimes];

  const start = localDay(range.start);
  const end = localDay(range.end);
  const covered = new Set(today.showtimes.map((showtime) => showtime.startsAt.slice(0, 10)));
  const days = [...new Set(today.dates)].filter((day) => day >= start && day <= end && !covered.has(day));
  if (days.length > MAX_DATES) warnings.push(`the site lists ${days.length} days; only the first ${MAX_DATES} were fetched`);

  const pages = await mapWithConcurrency(days.slice(0, MAX_DATES), 4, async (day) => {
    const url = new URL(SCHEDULE_DATA, BASE);
    url.searchParams.set("date", day);
    try {
      const parsed = parseCinemaCinemaSchedule(await fetchJson(url));
      return { day, parsed };
    } catch (error) {
      warnings.push(`${day}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  });

  for (const page of pages) {
    if (!page) continue;
    warnings.push(...page.parsed.warnings.map((warning) => `${page.day}: ${warning}`));
    for (const showtime of page.parsed.showtimes) {
      if (seen.has(showtime.sourceUid)) continue;
      seen.add(showtime.sourceUid);
      showtimes.push(showtime);
    }
  }

  return { showtimes, warnings, fetchedAt: new Date().toISOString() };
}

let sharedCrawl: { key: string; startedAt: number; promise: Promise<SharedCrawl> } | null = null;

/** The three venues run concurrently in one ingest; they share a single crawl of the site. */
function sharedCrawlFor(range: DateRange, crawl: (range: DateRange) => Promise<SharedCrawl>): Promise<SharedCrawl> {
  const key = `${localDay(range.start)}..${localDay(range.end)}`;
  const now = Date.now();
  if (!sharedCrawl || sharedCrawl.key !== key || now - sharedCrawl.startedAt > SHARED_CRAWL_TTL_MS) {
    const promise = crawl(range);
    sharedCrawl = { key, startedAt: now, promise };
    promise.catch(() => { if (sharedCrawl?.promise === promise) sharedCrawl = null; });
  }
  return sharedCrawl.promise;
}

export interface CinemaCinemaOptions {
  crawl?: (range: DateRange) => Promise<SharedCrawl>;
}

export async function extractCinemaCinema(venue: CinemaCinemaVenue, range: DateRange, options: CinemaCinemaOptions = {}): Promise<ExtractionBatch> {
  const crawl = await sharedCrawlFor(range, options.crawl ?? crawlCinemaCinema);
  return {
    venueSlug: venue.venueSlug,
    fetchedAt: crawl.fetchedAt,
    showtimes: crawl.showtimes.filter((showtime) => showtime.venueSlug === venue.venueSlug),
    warnings: [...crawl.warnings],
  };
}
