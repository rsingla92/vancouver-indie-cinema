import type { DateRange, ExtractionBatch } from "./contracts.js";
import { extractCinematheque, extractHollywood, extractRio, extractViff } from "./extractors/index.js";

export type { DateRange, ExtractionBatch, ExtractedShowtime } from "./contracts.js";
export * from "./extractors/index.js";

export async function extractAll(range: DateRange): Promise<ExtractionBatch[]> {
  return Promise.all([
    extractRio(range),
    extractCinematheque(),
    extractViff(),
    extractHollywood(),
  ]);
}
