import type { DateRange, ExtractionBatch } from "./contracts.js";
import { extractCinematheque, extractHollywood, extractRio, extractViff } from "./extractors/index.js";


export type { DateRange, ExtractionBatch, ExtractedShowtime } from "./contracts.js";
export * from "./extractors/index.js";
export * from "./normalization/contracts.js";
export * from "./normalization/normalizer.js";
export * from "./normalization/pipeline.js";
export * from "./normalization/repository.js";
export * from "./normalization/tmdb.js";


export async function extractAll(range: DateRange): Promise<ExtractionBatch[]> {
  return Promise.all([
    extractRio(range),
    extractCinematheque(),
    extractViff(),
    extractHollywood(),
  ]);
}
