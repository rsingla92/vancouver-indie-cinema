import type { DateRange, ExtractionBatch } from "../contracts.js";
import { CARLTON_CINEMA, extractOmniWeb } from "./omniweb.js";

/** Imagine Cinemas sells through OmniWeb; the Carlton is its Toronto location. */
export function extractCarlton(range: DateRange): Promise<ExtractionBatch> {
  return extractOmniWeb(CARLTON_CINEMA, range);
}
