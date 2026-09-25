import type { ShowtimeView, TheatreRef } from "./types";

/** Showtimes that have not started yet as of `now`. Input order is preserved. */
export function upcoming(items: ShowtimeView[], now: Date): ShowtimeView[] {
  const cutoff = now.getTime();
  return items.filter((item) => Date.parse(item.startsAt) >= cutoff);
}

/** One entry per film, keeping the earliest showtime. Input must be sorted by start time. */
export function firstShowtimePerMovie(items: ShowtimeView[]): ShowtimeView[] {
  const seen = new Set<string>();
  const output: ShowtimeView[] = [];
  for (const item of items) {
    if (seen.has(item.movieId)) continue;
    seen.add(item.movieId);
    output.push(item);
  }
  return output;
}

/** Distinct theatres in first-seen order. */
export function theatresOf(items: ShowtimeView[]): TheatreRef[] {
  return [...new Map(items.map((item) => [item.theatre.slug, item.theatre])).values()];
}

/** Distinct city names, alphabetical. */
export function citiesOf(items: ShowtimeView[]): string[] {
  return [...new Set(items.map((item) => item.theatre.city))].sort((a, b) => a.localeCompare(b));
}

/** Case-insensitive match on title or cinema name; an empty query matches everything. */
export function matchesQuery(item: ShowtimeView, query: string): boolean {
  const needle = query.trim().toLowerCase();
  return !needle || item.title.toLowerCase().includes(needle) || item.theatre.name.toLowerCase().includes(needle);
}
