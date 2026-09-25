import type { DateRange, ExtractionBatch } from "../contracts.js";
import { CINEMA_BEAUBIEN, extractCinemaCinema } from "./cinemacinema.js";

/** Reads the shared cinemacinema.ca schedule and keeps this cinema's screenings. */
export function extractBeaubien(range: DateRange): Promise<ExtractionBatch> {
  return extractCinemaCinema(CINEMA_BEAUBIEN, range);
}
