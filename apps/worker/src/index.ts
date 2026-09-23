import type { DateRange, ExtractionBatch } from "./contracts.js";
import { VENUE_EXTRACTORS } from "./extractors/index.js";

export type { DateRange, ExtractionBatch, ExtractedShowtime, VenueSlug } from "./contracts.js";
export { extractedShowtimeSchema, venueSlugSchema } from "./contracts.js";
export * from "./extractors/index.js";
export * from "./jobs/ingest.js";
export * from "./normalization/contracts.js";
export * from "./normalization/normalizer.js";
export * from "./normalization/pipeline.js";
export * from "./normalization/repository.js";
export * from "./normalization/tmdb.js";

/** Fetch every venue in parallel. Rejects if any venue fails; the ingest job isolates failures per venue. */
export async function extractAll(range: DateRange): Promise<ExtractionBatch[]> {
  return Promise.all(Object.values(VENUE_EXTRACTORS).map((extract) => extract(range)));
}
