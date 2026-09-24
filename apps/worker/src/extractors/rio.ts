import type { DateRange, ExtractionBatch } from "../contracts.js";
import { extractBarker, parseBarkerPayload, RIO_THEATRE, type ParsedBarkerPayload } from "./barker.js";

export function parseRioPayload(payload: unknown): ParsedBarkerPayload {
  return parseBarkerPayload(RIO_THEATRE.venueSlug, payload);
}

export function extractRio(range: DateRange): Promise<ExtractionBatch> {
  return extractBarker(RIO_THEATRE, range);
}
