import { z } from "zod";

export const venueSlugSchema = z.enum([
  "rio-theatre",
  "the-cinematheque",
  "viff-centre",
  "hollywood-theatre",
]);

export const extractedShowtimeSchema = z.object({
  venueSlug: venueSlugSchema,
  sourceUid: z.string().min(1),
  rawTitle: z.string().min(1),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }).optional(),
  detailUrl: z.string().url(),
  ticketUrl: z.string().url().optional(),
  status: z.enum(["scheduled", "sold_out", "cancelled"]).default("scheduled"),
  tags: z.array(z.string()).default([]),
  sourcePayload: z.record(z.string(), z.unknown()),
});

export type VenueSlug = z.infer<typeof venueSlugSchema>;
export type ExtractedShowtime = z.infer<typeof extractedShowtimeSchema>;

export interface ExtractionBatch {
  venueSlug: VenueSlug;
  fetchedAt: string;
  showtimes: ExtractedShowtime[];
  warnings: string[];
}

export interface DateRange {
  start: Date;
  end: Date;
}
