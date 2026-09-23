import type { ShowtimeView } from "./types";

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

/** Case-insensitive match on title or cinema name; an empty query matches everything. */
export function matchesQuery(item: ShowtimeView, query: string): boolean {
  const needle = query.trim().toLowerCase();
  return !needle || item.title.toLowerCase().includes(needle) || item.theatre.name.toLowerCase().includes(needle);
}
