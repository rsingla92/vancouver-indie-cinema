import type { DateRange, ExtractionBatch, VenueSlug } from "../contracts.js";
import { extractBeaubien } from "./beaubien.js";
import { extractCinematheque } from "./cinematheque.js";
import { extractDuMusee } from "./du-musee.js";
import { extractDuParc } from "./du-parc.js";
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
export { extractCinemaCinema, parseCinemaCinemaSchedule, decodeSvelteKitData, decodeDevalue, CINEMA_BEAUBIEN, CINEMA_DU_PARC, CINEMA_DU_MUSEE, type CinemaCinemaVenue } from "./cinemacinema.js";
export { extractBeaubien } from "./beaubien.js";
export { extractDuParc } from "./du-parc.js";
export { extractDuMusee } from "./du-musee.js";

export type VenueExtractor = (range: DateRange) => Promise<ExtractionBatch>;

/** One extractor per venue. The Barker and cinemacinema.ca venues accept a date range; the others publish their full schedule. */
export const VENUE_EXTRACTORS: Readonly<Record<VenueSlug, VenueExtractor>> = {
  "rio-theatre": (range) => extractRio(range),
  "park-theatre": (range) => extractPark(range),
  "the-cinematheque": () => extractCinematheque(),
  "viff-centre": () => extractViff(),
  "hollywood-theatre": () => extractHollywood(),
  "cinema-du-parc": (range) => extractDuParc(range),
  "cinema-beaubien": (range) => extractBeaubien(range),
  "cinema-du-musee": (range) => extractDuMusee(range),
};
