import { z } from "zod";
import type { DateRange, ExtractionBatch, ExtractedShowtime } from "../contracts.js";
import { extractedShowtimeSchema } from "../contracts.js";
import { fetchJson } from "../http.js";

const rioListingSchema = z.object({
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

const rioPayloadSchema = z.array(rioListingSchema);

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseRioPayload(payload: unknown): ExtractedShowtime[] {
  return rioPayloadSchema.parse(payload).map((row) => {
    const endIsUseful = row.end_time && row.end_time !== row.start_time;
    return extractedShowtimeSchema.parse({
      venueSlug: "rio-theatre",
      sourceUid: String(row.id),
      rawTitle: row.event.title,
      startsAt: row.start_time,
      ...(endIsUseful ? { endsAt: row.end_time } : {}),
      detailUrl: row.event.link,
      ...(row.tickets_link ? { ticketUrl: row.tickets_link } : {}),
      tags: [row.premiere ? "premiere" : "", row.extra].filter(Boolean),
      sourcePayload: row,
    });
  });
}

export async function extractRio(range: DateRange): Promise<ExtractionBatch> {
  const url = new URL("https://riotheatre.ca/wp-json/barker/v1/listings");
  url.search = new URLSearchParams({
    start_date: ymd(range.start),
    end_date: ymd(range.end),
    status: "publish",
    per_page: "500",
    page: "1",
    _embed: "1",
  }).toString();

  return {
    venueSlug: "rio-theatre",
    fetchedAt: new Date().toISOString(),
    showtimes: parseRioPayload(await fetchJson(url)),
    warnings: [],
  };
}
