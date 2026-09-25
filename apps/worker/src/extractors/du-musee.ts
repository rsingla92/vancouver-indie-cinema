import type { DateRange, ExtractionBatch } from "../contracts.js";
import { CINEMA_DU_MUSEE, extractCinemaCinema } from "./cinemacinema.js";

/** Reads the shared cinemacinema.ca schedule and keeps this cinema's screenings. */
export function extractDuMusee(range: DateRange): Promise<ExtractionBatch> {
  return extractCinemaCinema(CINEMA_DU_MUSEE, range);
}
