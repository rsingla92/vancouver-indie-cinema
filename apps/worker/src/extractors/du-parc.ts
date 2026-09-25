import type { DateRange, ExtractionBatch } from "../contracts.js";
import { CINEMA_DU_PARC, extractCinemaCinema } from "./cinemacinema.js";

/** Reads the shared cinemacinema.ca schedule and keeps this cinema's screenings. */
export function extractDuParc(range: DateRange): Promise<ExtractionBatch> {
  return extractCinemaCinema(CINEMA_DU_PARC, range);
}
