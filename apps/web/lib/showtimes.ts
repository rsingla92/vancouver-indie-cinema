import { dateKey, formatMonth } from "./format";
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

/** Whole sentences up to about `max` characters; a single sentence longer than that is cut at a word. */
export function shortSynopsis(text: string, max = 200): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const sentences = clean.match(/[^.!?]+[.!?]+["')\]]*(?=\s|$)/g) ?? [];
  let output = "";
  for (const sentence of sentences) {
    const next = `${output} ${sentence.trim()}`.trim();
    if (next.length > max) break;
    output = next;
  }
  if (output) return output;
  const cut = clean.lastIndexOf(" ", max - 1);
  return `${clean.slice(0, cut > 0 ? cut : max - 1).trimEnd()}…`;
}

export interface DateWindow {
  /** "7d", "30d", a "2026-10" month key, or "all". */
  id: string;
  label: string;
}

export const DEFAULT_WINDOW = "7d";
const DAY_MS = 86_400_000;

/** The windows a listing can be narrowed to: two rolling ranges, then each calendar month the data covers. */
export function windowsOf(items: ShowtimeView[], timezone: string): DateWindow[] {
  const months = [...new Set(items.map((item) => dateKey(item.startsAt, timezone).slice(0, 7)))].sort();
  return [
    { id: "7d", label: "Next 7 days" },
    { id: "30d", label: "Next 30 days" },
    ...months.map((key) => ({ id: key, label: formatMonth(key) })),
    { id: "all", label: "All dates" },
  ];
}

/** Whether a showtime falls in the window; rolling windows count calendar days in the venue's zone, today included. */
export function inWindow(item: ShowtimeView, windowId: string, now: Date, timezone: string): boolean {
  if (windowId === "all") return true;
  const day = dateKey(item.startsAt, timezone);
  if (windowId === "7d" || windowId === "30d") {
    const days = windowId === "7d" ? 7 : 30;
    return day <= dateKey(new Date(now.getTime() + (days - 1) * DAY_MS), timezone);
  }
  return day.startsWith(windowId);
}

/** Case-insensitive match on title or cinema name; an empty query matches everything. */
export function matchesQuery(item: ShowtimeView, query: string): boolean {
  const needle = query.trim().toLowerCase();
  return !needle || item.title.toLowerCase().includes(needle) || item.theatre.name.toLowerCase().includes(needle);
}
