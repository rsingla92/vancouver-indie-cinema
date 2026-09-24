import { DateTime } from "luxon";
import { z } from "zod";
import type { DateRange, ExtractionBatch, ExtractedShowtime, VenueSlug } from "../contracts.js";
import { extractedShowtimeSchema } from "../contracts.js";
import { fetchJson } from "../http.js";
import { VANCOUVER_TZ } from "./utils.js";

/**
 * Venues whose WordPress sites publish their schedule through the Barker events
 * plugin. The Rio and the Park share management and the same site stack.
 */
export interface BarkerVenue {
  venueSlug: VenueSlug;
  baseUrl: string;
}

export const RIO_THEATRE: BarkerVenue = { venueSlug: "rio-theatre", baseUrl: "https://riotheatre.ca" };
export const PARK_THEATRE: BarkerVenue = { venueSlug: "park-theatre", baseUrl: "https://www.theparktheatre.ca" };

/** WordPress caps REST pages at 100, so a shorter page reliably means the last one. */
const PAGE_SIZE = 100;
const MAX_PAGES = 25;

const barkerListingSchema = z.object({
  id: z.union([z.number(), z.string()]),
  event: z.object({
    id: z.union([z.number(), z.string()]),
    title: z.string().min(1),
    link: z.string().url(),
  }),
  start_time: z.string().datetime({ offset: true }),
  end_time: z.string().datetime({ offset: true }).optional().or(z.literal("")),
  extra: z.string().optional().default(""),
  premiere: z.boolean().optional().default(false),
  tickets_link: z.string().optional().default(""),
});

export interface ParsedBarkerPayload {
  showtimes: ExtractedShowtime[];
  warnings: string[];
}

export interface BarkerOptions {
  pageSize?: number;
  maxPages?: number;
}

/** The venue's WordPress site reads dates on the Vancouver calendar, not UTC. */
function localDate(date: Date): string {
  const value = DateTime.fromJSDate(date).setZone(VANCOUVER_TZ).toISODate();
  if (!value) throw new Error(`Invalid date: ${String(date)}`);
  return value;
}

function issues(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".") || "value"} ${issue.message}`).join("; ");
}

/** Parse one page of listings. A malformed listing is reported and skipped rather than failing the venue. */
export function parseBarkerPayload(venueSlug: VenueSlug, payload: unknown): ParsedBarkerPayload {
  if (!Array.isArray(payload)) throw new Error("Barker listings response is not an array");
  const showtimes: ExtractedShowtime[] = [];
  const warnings: string[] = [];

  payload.forEach((entry, index) => {
    const listing = barkerListingSchema.safeParse(entry);
    if (!listing.success) {
      warnings.push(`listing ${index}: ${issues(listing.error)}`);
      return;
    }
    const row = listing.data;
    // Barker repeats the start time as the end time when no duration is known.
    const endsAt = row.end_time && Date.parse(row.end_time) > Date.parse(row.start_time) ? row.end_time : undefined;
    const extra = row.extra.replace(/\s+/g, " ").trim();
    const showtime = extractedShowtimeSchema.safeParse({
      venueSlug,
      sourceUid: String(row.id),
      rawTitle: row.event.title.trim(),
      startsAt: row.start_time,
      ...(endsAt ? { endsAt } : {}),
      detailUrl: row.event.link,
      ...(row.tickets_link ? { ticketUrl: row.tickets_link } : {}),
      tags: [row.premiere ? "premiere" : "", extra].filter(Boolean),
      sourcePayload: row,
    });
    if (!showtime.success) {
      warnings.push(`listing ${row.id}: ${issues(showtime.error)}`);
      return;
    }
    showtimes.push(showtime.data);
  });

  return { showtimes, warnings };
}

export async function extractBarker(venue: BarkerVenue, range: DateRange, options: BarkerOptions = {}): Promise<ExtractionBatch> {
  const pageSize = options.pageSize ?? PAGE_SIZE;
  const maxPages = options.maxPages ?? MAX_PAGES;
  const showtimes: ExtractedShowtime[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= maxPages; page += 1) {
    const url = new URL("/wp-json/barker/v1/listings", venue.baseUrl);
    url.search = new URLSearchParams({
      start_date: localDate(range.start),
      end_date: localDate(range.end),
      status: "publish",
      per_page: String(pageSize),
      page: String(page),
      _embed: "1",
    }).toString();

    const payload = await fetchJson(url);
    const parsed = parseBarkerPayload(venue.venueSlug, payload);
    warnings.push(...parsed.warnings.map((warning) => `page ${page} ${warning}`));
    const fresh = parsed.showtimes.filter((showtime) => !seen.has(showtime.sourceUid));
    fresh.forEach((showtime) => seen.add(showtime.sourceUid));
    showtimes.push(...fresh);

    const received = (payload as unknown[]).length;
    if (received < pageSize) break;
    if (fresh.length === 0) {
      warnings.push(`page ${page} repeated earlier listings; the endpoint may not paginate, so listings may be incomplete`);
      break;
    }
    if (page === maxPages) warnings.push(`stopped at page cap (${maxPages}); listings may be incomplete`);
  }

  return { venueSlug: venue.venueSlug, fetchedAt: new Date().toISOString(), showtimes, warnings };
}
