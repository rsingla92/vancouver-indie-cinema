import type { DateRange, ExtractionBatch } from "../contracts.js";
import { CINEMATHEQUE_QUEBECOISE, extractOmniWeb } from "./omniweb.js";

/** The Cinémathèque's own site refuses server-side requests, so its OmniWeb box office is the source. */
export function extractCinemathequeQuebecoise(range: DateRange): Promise<ExtractionBatch> {
  return extractOmniWeb(CINEMATHEQUE_QUEBECOISE, range);
}
