import type { DateRange, ExtractionBatch, ExtractedShowtime } from "../contracts.js";
import { extractBarker, parseBarkerPayload, PARK_THEATRE } from "./barker.js";

/** The Park reopened in December 2025 under the Rio's management and publishes its schedule the same way. */
export function parseParkPayload(payload: unknown): ExtractedShowtime[] {
  return parseBarkerPayload(PARK_THEATRE.venueSlug, payload);
}

export function extractPark(range: DateRange): Promise<ExtractionBatch> {
  return extractBarker(PARK_THEATRE, range);
}
