import { load } from "cheerio";
import { DateTime } from "luxon";
import { z } from "zod";
import type { DateRange, ExtractionBatch, ExtractedShowtime, VenueSlug } from "../contracts.js";
import { extractedShowtimeSchema } from "../contracts.js";
import { fetchText } from "../http.js";
import { iso, mapWithConcurrency, TORONTO_TZ } from "./utils.js";

/**
 * OmniWeb Ticketing (omniwebticketing6.com) sells for the Cinémathèque québécoise
 * and for Imagine Cinemas, whose Carlton is the Toronto venue here. Both venues'
 * own sites link to it, and the Cinémathèque's site blocks server-side requests
 * outright, so the box office is the schedule source. A day page carries every
 * performance of that day as a `gMovieData` object in a script and a `<select>`
 * of every day that has performances; one request per day inside the horizon
 * covers the schedule.
 */
export interface OmniWebVenue {
  venueSlug: VenueSlug;
  /** Path under omniwebticketing6.com, as the venue's own site links it. */
  path: string;
  /** The venue's own programme page, for people rather than for the crawl. */
  detailUrl: string;
}

export const CINEMATHEQUE_QUEBECOISE: OmniWebVenue = { venueSlug: "cinematheque-quebecoise", path: "cinematheque", detailUrl: "https://www.cinematheque.qc.ca/fr/programmation" };
export const CARLTON_CINEMA: OmniWebVenue = { venueSlug: "carlton-cinema", path: "imaginecinemas/carlton", detailUrl: "https://imaginecinemas.com/cinema/carlton/" };

const BASE = "https://omniwebticketing6.com";
const MAX_DAYS = 120;
/** The box office answers 429 to parallel requests, so every request to it waits its turn. */
const REQUEST_GAP_MS = 400;

let queue: Promise<unknown> = Promise.resolve();
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** One request at a time to omniwebticketing6.com, shared by every venue on it, with a pause between requests. */
export function fetchOmniWeb(url: URL, fetchPage: (url: URL) => Promise<string> = fetchText): Promise<string> {
  const turn = queue.then(() => fetchPage(url));
  queue = turn.catch(() => undefined).then(() => sleep(REQUEST_GAP_MS));
  return turn;
}

export function omniWebDayUrl(venue: OmniWebVenue, day: string): URL {
  return new URL(`/${venue.path}/?schdate=${day}`, BASE);
}

/** The venue sites link a performance as `?schdate=<day>&perfix=<performance id>`. */
export function omniWebTicketUrl(venue: OmniWebVenue, day: string, perfIx: string): string {
  return `${BASE}/${venue.path}/?schdate=${day}&perfix=${perfIx}`;
}

const performanceSchema = z.object({
  perfIx: z.union([z.string(), z.number()]).transform(String),
  curtainTime: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/),
  schDateStr: z.string().optional(),
  seatsRemaining: z.union([z.string(), z.number()]).optional(),
  type: z.string().optional(),
});

const auditoriumSchema = z.object({
  name: z.string().optional(),
  schPerfsGeneral: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]).optional(),
  schPerfsReserved: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]).optional(),
});

const filmSchema = z.object({
  code: z.union([z.string(), z.number()]).transform(String),
  title: z.string().min(1),
  runTimeStr: z.string().optional(),
  ratingReason: z.string().optional(),
  schAuds: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]).optional().default({}),
});

/** "Maria Chapdelaine (VOSTA)": a version label; "Kiki's Delivery Service (DUB) (1989)": a version and a year. */
const TRAILING_LABEL = /\s*\(([^()]*)\)\s*$/;
const VERSION_LABEL = /^(?:V\.?O\.?(?:S\.?T\.?[FA]\.?|[FA]\.?)?|V\.?F\.?|S\.?T\.?[FA]\.?|VOSTA|VOSTF|VOF|VOA|VF|VA|SUB|DUB|SUBBED|DUBBED|3D|IMAX)$/i;

/** Titles arrive HTML-escaped ("Kiki&apos;s", "&amp;"). */
function decodeTitle(value: string): string {
  return load(`<x>${value}</x>`)("x").text().replace(/\s+/g, " ").trim();
}

/** Split the trailing labels off a title into a version tag and a year, leaving the title as printed. */
export function readTitleLabels(title: string): { tags: string[]; year?: number } {
  const tags: string[] = [];
  let year: number | undefined;
  let rest = title;
  for (let match = rest.match(TRAILING_LABEL); match; match = rest.match(TRAILING_LABEL)) {
    const label = match[1]!.trim();
    if (/^(?:18|19|20)\d{2}$/.test(label)) year = Number(label);
    else if (VERSION_LABEL.test(label)) tags.unshift(label.toUpperCase().replace(/\./g, ""));
    else break;
    rest = rest.slice(0, match.index);
  }
  return { tags, ...(year ? { year } : {}) };
}

/** Read the `var gMovieData = {...};` literal out of the page script. */
export function readMovieData(html: string): unknown {
  const marker = "var gMovieData = ";
  const start = html.indexOf(marker);
  if (start === -1) throw new Error("day page has no gMovieData");
  let depth = 0;
  let inString = false;
  for (let i = start + marker.length; i < html.length; i += 1) {
    const char = html[i]!;
    if (inString) {
      if (char === "\\") i += 1;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{" || char === "[") depth += 1;
    else if (char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0) return JSON.parse(html.slice(start + marker.length, i + 1));
    }
  }
  throw new Error("gMovieData is not terminated");
}

function values(collection: Record<string, unknown> | unknown[] | undefined): unknown[] {
  if (!collection) return [];
  return Array.isArray(collection) ? collection : Object.values(collection);
}

function issues(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".") || "value"} ${issue.message}`).join("; ");
}

export interface ParsedOmniWebDay {
  showtimes: ExtractedShowtime[];
  /** Every day (YYYY-MM-DD) the box office offers, from the page's date selector. */
  dates: string[];
  warnings: string[];
}

export function parseOmniWebDay(venue: OmniWebVenue, html: string): ParsedOmniWebDay {
  const dates = [...new Set([...html.matchAll(/<option[^>]*value="(\d{4}-\d{2}-\d{2})"/g)].map((match) => match[1]!))];
  const showtimes: ExtractedShowtime[] = [];
  const warnings: string[] = [];

  for (const entry of values(readMovieData(html) as Record<string, unknown>)) {
    const film = filmSchema.safeParse(entry);
    if (!film.success) {
      warnings.push(`film: ${issues(film.error)}`);
      continue;
    }
    const title = decodeTitle(film.data.title);
    const { tags, year } = readTitleLabels(title);

    for (const auditoriumEntry of values(film.data.schAuds as Record<string, unknown>)) {
      const auditorium = auditoriumSchema.safeParse(auditoriumEntry);
      if (!auditorium.success) {
        warnings.push(`film ${film.data.code}: ${issues(auditorium.error)}`);
        continue;
      }
      for (const raw of [...values(auditorium.data.schPerfsGeneral), ...values(auditorium.data.schPerfsReserved)]) {
        const performance = performanceSchema.safeParse(raw);
        if (!performance.success) {
          warnings.push(`film ${film.data.code}: performance ${issues(performance.error)}`);
          continue;
        }
        const row = performance.data;
        const startsAt = DateTime.fromFormat(row.curtainTime.slice(0, 16), "yyyy-MM-dd HH:mm", { zone: TORONTO_TZ });
        if (!startsAt.isValid) {
          warnings.push(`performance ${row.perfIx}: unreadable time "${row.curtainTime}"`);
          continue;
        }
        const day = row.curtainTime.slice(0, 10);
        const seats = row.seatsRemaining === undefined ? undefined : Number(row.seatsRemaining);
        const showtime = extractedShowtimeSchema.safeParse({
          venueSlug: venue.venueSlug,
          sourceUid: row.perfIx,
          rawTitle: title,
          startsAt: iso(startsAt),
          detailUrl: venue.detailUrl,
          ticketUrl: omniWebTicketUrl(venue, day, row.perfIx),
          ...(year ? { releaseYear: year } : {}),
          status: seats === 0 ? "sold_out" : "scheduled",
          tags,
          sourcePayload: { filmCode: film.data.code, perfIx: row.perfIx, auditorium: auditorium.data.name, runTime: film.data.runTimeStr, rating: film.data.ratingReason, seatsRemaining: row.seatsRemaining, type: row.type },
        });
        if (!showtime.success) {
          warnings.push(`performance ${row.perfIx}: ${issues(showtime.error)}`);
          continue;
        }
        showtimes.push(showtime.data);
      }
    }
  }

  return { showtimes, dates, warnings };
}

export async function extractOmniWeb(venue: OmniWebVenue, range: DateRange): Promise<ExtractionBatch> {
  const start = DateTime.fromJSDate(range.start).setZone(TORONTO_TZ).toISODate()!;
  const end = DateTime.fromJSDate(range.end).setZone(TORONTO_TZ).toISODate()!;
  const first = parseOmniWebDay(venue, await fetchOmniWeb(omniWebDayUrl(venue, start)));
  const warnings = [...first.warnings];
  const seen = new Set(first.showtimes.map((showtime) => showtime.sourceUid));
  const showtimes = [...first.showtimes];
  if (first.dates.length === 0) warnings.push(`${omniWebDayUrl(venue, start)}: the page lists no dates`);

  const covered = new Set(first.showtimes.map((showtime) => showtime.startsAt.slice(0, 10)));
  const days = first.dates.filter((day) => day >= start && day <= end && !covered.has(day));
  if (days.length > MAX_DAYS) warnings.push(`the box office lists ${days.length} days; only the first ${MAX_DAYS} were fetched`);

  const pages = await mapWithConcurrency(days.slice(0, MAX_DAYS), 4, async (day) => {
    try {
      return { day, parsed: parseOmniWebDay(venue, await fetchOmniWeb(omniWebDayUrl(venue, day))) };
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

  return { venueSlug: venue.venueSlug, fetchedAt: new Date().toISOString(), showtimes, warnings };
}
