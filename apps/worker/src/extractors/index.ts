import type { DateRange, ExtractionBatch, VenueSlug } from "../contracts.js";
import { extractCinematheque } from "./cinematheque.js";
import { extractHollywood } from "./hollywood.js";
import { extractRio } from "./rio.js";
import { extractViff } from "./viff.js";

export { extractRio, parseRioPayload } from "./rio.js";
export { extractCinematheque, parseCinemathequeFilmLinks, parseCinemathequeFilmPage } from "./cinematheque.js";
export { extractViff, parseViffPage } from "./viff.js";
export { extractHollywood, parseHollywoodEventLinks, parseHollywoodEventPage } from "./hollywood.js";

export type VenueExtractor = (range: DateRange) => Promise<ExtractionBatch>;

/** One extractor per venue. Only the Rio API accepts a date range; the others publish their full schedule. */
export const VENUE_EXTRACTORS: Readonly<Record<VenueSlug, VenueExtractor>> = {
  "rio-theatre": (range) => extractRio(range),
  "the-cinematheque": () => extractCinematheque(),
  "viff-centre": () => extractViff(),
  "hollywood-theatre": () => extractHollywood(),
};
