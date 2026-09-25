import type { ShowtimeView } from "./types";

export const SAVED_KEY = "doublebill:saved";
/** Key used before the site was renamed; read once, never written. */
const LEGACY_SAVED_KEY = "indiescreen:saved";

/** A film the viewer wants to keep, stored in the browser so it survives the schedule moving on. */
export interface SavedFilm {
  movieId: string;
  title: string;
  theatre: string;
}

/**
 * Parse stored saved films. The first release stored bare movie ids; those are
 * upgraded when the film is still listed and dropped when it is not.
 */
export function parseSaved(raw: string | null, showtimes: ShowtimeView[]): SavedFilm[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw ?? "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const output: SavedFilm[] = [];
  for (const entry of parsed) {
    if (typeof entry === "string") {
      const listed = showtimes.find((item) => item.movieId === entry);
      if (listed) output.push({ movieId: listed.movieId, title: listed.title, theatre: listed.theatre.name });
      continue;
    }
    if (entry && typeof entry === "object" && typeof (entry as SavedFilm).movieId === "string" && typeof (entry as SavedFilm).title === "string") {
      const film = entry as SavedFilm;
      output.push({ movieId: film.movieId, title: film.title, theatre: typeof film.theatre === "string" ? film.theatre : "" });
    }
  }
  return output.filter((film, index) => output.findIndex((other) => other.movieId === film.movieId) === index);
}

export function toggleSaved(saved: SavedFilm[], film: SavedFilm): SavedFilm[] {
  return saved.some((entry) => entry.movieId === film.movieId)
    ? saved.filter((entry) => entry.movieId !== film.movieId)
    : [...saved, film];
}

export function readSaved(showtimes: ShowtimeView[]): SavedFilm[] {
  try {
    return parseSaved(localStorage.getItem(SAVED_KEY) ?? localStorage.getItem(LEGACY_SAVED_KEY), showtimes);
  } catch {
    return [];
  }
}

export function writeSaved(saved: SavedFilm[]): void {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
  } catch {
    // Storage may be unavailable (private mode, quota); saving is best-effort.
  }
}
