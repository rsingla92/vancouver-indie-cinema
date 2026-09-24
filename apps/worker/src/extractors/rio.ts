import type { DateRange, ExtractionBatch, ExtractedShowtime } from "../contracts.js";
import { extractBarker, parseBarkerPayload, RIO_THEATRE } from "./barker.js";

export function parseRioPayload(payload: unknown): ExtractedShowtime[] {
  return parseBarkerPayload(RIO_THEATRE.venueSlug, payload);
}

export function extractRio(range: DateRange): Promise<ExtractionBatch> {
  return extractBarker(RIO_THEATRE, range);
}
