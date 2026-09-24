import { z } from "zod";
import type { DateRange, ExtractionBatch, ExtractedShowtime, VenueSlug } from "../contracts.js";
import { extractedShowtimeSchema } from "../contracts.js";
import { fetchJson } from "../http.js";

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

const barkerPayloadSchema = z.array(barkerListingSchema);

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseBarkerPayload(venueSlug: VenueSlug, payload: unknown): ExtractedShowtime[] {
  return barkerPayloadSchema.parse(payload).map((row) => {
    // Barker repeats the start time as the end time when no duration is known.
    const endsAt = row.end_time && Date.parse(row.end_time) > Date.parse(row.start_time) ? row.end_time : undefined;
    const extra = row.extra.replace(/\s+/g, " ").trim();
    return extractedShowtimeSchema.parse({
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
  });
}

export async function extractBarker(venue: BarkerVenue, range: DateRange): Promise<ExtractionBatch> {
  const url = new URL("/wp-json/barker/v1/listings", venue.baseUrl);
  url.search = new URLSearchParams({
    start_date: ymd(range.start),
    end_date: ymd(range.end),
    status: "publish",
    per_page: "500",
    page: "1",
    _embed: "1",
  }).toString();

  return {
    venueSlug: venue.venueSlug,
    fetchedAt: new Date().toISOString(),
    showtimes: parseBarkerPayload(venue.venueSlug, await fetchJson(url)),
    warnings: [],
  };
}
