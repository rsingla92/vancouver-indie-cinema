import type { DateRange, ExtractionBatch, VenueSlug } from "../contracts.js";
import { extractCinematheque } from "./cinematheque.js";
import { extractHollywood } from "./hollywood.js";
import { extractPark } from "./park.js";
import { extractRio } from "./rio.js";
import { extractViff } from "./viff.js";

export { extractBarker, parseBarkerPayload, PARK_THEATRE, RIO_THEATRE, type BarkerOptions, type BarkerVenue, type ParsedBarkerPayload } from "./barker.js";
export { extractRio, parseRioPayload } from "./rio.js";
export { extractPark, parseParkPayload } from "./park.js";
export { extractCinematheque, parseCinemathequeFilmLinks, parseCinemathequeFilmPage, parseFilmYear } from "./cinematheque.js";
export { extractViff, parseViffPage } from "./viff.js";
export { extractHollywood, parseHollywoodEventLinks, parseHollywoodEventPage } from "./hollywood.js";

export type VenueExtractor = (range: DateRange) => Promise<ExtractionBatch>;

/** One extractor per venue. Only the Barker venues accept a date range; the others publish their full schedule. */
export const VENUE_EXTRACTORS: Readonly<Record<VenueSlug, VenueExtractor>> = {
  "rio-theatre": (range) => extractRio(range),
  "park-theatre": (range) => extractPark(range),
  "the-cinematheque": () => extractCinematheque(),
  "viff-centre": () => extractViff(),
  "hollywood-theatre": () => extractHollywood(),
};
