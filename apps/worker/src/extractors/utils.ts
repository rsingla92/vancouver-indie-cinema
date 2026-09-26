import { load } from "cheerio";
import { DateTime } from "luxon";
import type { ExtractedShowtime } from "../contracts.js";

export const VANCOUVER_TZ = "America/Vancouver";
/** Toronto and Montreal share the Eastern zone. */
export const TORONTO_TZ = "America/Toronto";

/** A listing is never this far from the crawl date; a weekday that only fits a year away is a typo. */
const MAX_DISTANCE_DAYS = 200;

export function cleanText(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function absoluteUrl(href: string, base: string): string {
  return new URL(href, base).toString();
}

/**
 * Venue listings rarely print a year. Assume the schedule looks forward: a month
 * more than six months behind the reference belongs to next year, and one more
 * than six months ahead belongs to last year.
 */
export function inferYear(month: number, reference: DateTime): number {
  let year = reference.year;
  const distance = month - reference.month;
  if (distance < -6) year += 1;
  if (distance > 6) year -= 1;
  return year;
}

function formatHasYear(format: string): boolean {
  return /y/.test(format.replace(/'[^']*'/g, ""));
}

/**
 * Parse a venue-local date/time string with one of the given Luxon formats. The
 * zone defaults to Vancouver; Toronto and Montreal venues pass `TORONTO_TZ`.
 *
 * - Formats that already contain a year token are parsed verbatim.
 * - Otherwise the year is inferred relative to `reference` (or fixed with `year`).
 *   Candidate years are validated by Luxon, so a weekday token such as "Sat"
 *   rejects years where the weekday does not line up, and a candidate that only
 *   fits far from the reference is rejected too so the caller can fall back.
 */
export function parseDateTime(
  value: string,
  formats: string[],
  options: { year?: number; reference?: DateTime; zone?: string; locale?: string } = {},
): DateTime {
  const zone = options.zone ?? VANCOUVER_TZ;
  const parseOptions = { zone, locale: options.locale ?? "en-CA" };
  const reference = (options.reference ?? DateTime.now()).setZone(zone);
  const candidateYears = options.year !== undefined
    ? [options.year]
    : [reference.year - 1, reference.year, reference.year + 1];

  for (const format of formats) {
    if (formatHasYear(format)) {
      const parsed = DateTime.fromFormat(value, format, parseOptions);
      if (parsed.isValid) return parsed;
      continue;
    }

    const valid = candidateYears
      .map((year) => DateTime.fromFormat(`${value} ${year}`, `${format} yyyy`, parseOptions))
      .filter((parsed) => parsed.isValid)
      .filter((parsed) => options.year !== undefined || Math.abs(parsed.diff(reference, "days").days) <= MAX_DISTANCE_DAYS)
      .sort((a, b) => Math.abs(a.diff(reference, "days").days) - Math.abs(b.diff(reference, "days").days));
    if (valid.length === 0) continue;

    return valid.find((parsed) => parsed.year === inferYear(parsed.month, reference)) ?? valid[0]!;
  }

  throw new Error(`Unable to parse ${zone} date/time: ${value}`);
}

export function iso(dateTime: DateTime): string {
  const value = dateTime.toISO({ suppressMilliseconds: true });
  if (!value) throw new Error("Invalid datetime");
  return value;
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await mapper(items[index]!);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}

/** "Japan 1962. Dir: Masaki Kobayashi.": the year closest before a director credit. */
const YEAR_BEFORE_DIRECTOR = /\b((?:18|19|20)\d{2})\b(?:(?!\b(?:18|19|20)\d{2}\b)[\s\S]){0,60}?\bdir(?:\.|:|ector|ected|\.:)/i;
/** "Canada, 2026, 94 min", "USA | 1990 | 113 min": a year followed by a running time, with no other number between. */
const YEAR_BEFORE_RUNTIME = /\b((?:18|19|20)\d{2})\b[^\d]{0,40}?\b\d{1,3}\s*(?:min(?:ute)?s?|mins?)(?![a-z])/gi;
/** "October 3, 2026", "3 October 2026", "Fri Oct 3 2026": the year is part of a screening date, not a release year. */
const DATE_BEFORE_YEAR = /(?:\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?,?\s+\d{1,2}(?:st|nd|rd|th)?,?\s*|\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?,?\s*|\b\d{1,2}[./-]\d{1,2}[./-])$/i;

/**
 * The release year a venue prints beside a film, or null. Only a year anchored to a
 * director credit or a running time counts, so a season label such as "VIFF 2026"
 * or a title such as "2001: A Space Odyssey" is never mistaken for one, and a year
 * that is part of a screening date ("October 3, 2026 · 113 min") is skipped.
 */
export function printedYear(text: string, maxYear: number): number | null {
  const credited = Number(text.match(YEAR_BEFORE_DIRECTOR)?.[1] ?? NaN);
  if (credited >= 1888 && credited <= maxYear) return credited;
  for (const match of text.matchAll(YEAR_BEFORE_RUNTIME)) {
    const year = Number(match[1]);
    if (year < 1888 || year > maxYear) continue;
    if (DATE_BEFORE_YEAR.test(text.slice(Math.max(0, match.index - 24), match.index))) continue;
    return year;
  }
  return null;
}

export interface PrintedYearOptions {
  concurrency?: number;
  maxYear?: number;
}

/**
 * Fetch each film's own page once and take the year it prints, for showtimes that
 * have none. A page that cannot be read or names no year costs nothing but a
 * possible match, so failures are silent.
 */
export async function addPrintedYears(
  showtimes: ExtractedShowtime[],
  fetchPage: (url: URL) => Promise<string>,
  options: PrintedYearOptions = {},
): Promise<void> {
  const maxYear = options.maxYear ?? new Date().getFullYear() + 1;
  const pages = [...new Set(showtimes.filter((showtime) => !showtime.releaseYear).map((showtime) => showtime.detailUrl))];
  const years = new Map<string, number | null>();
  await mapWithConcurrency(pages, options.concurrency ?? 2, async (url) => {
    try {
      years.set(url, printedYear(cleanText(load(await fetchPage(new URL(url)))("body").text()), maxYear));
    } catch {
      years.set(url, null);
    }
  });
  for (const showtime of showtimes) {
    const year = years.get(showtime.detailUrl);
    if (!showtime.releaseYear && year) showtime.releaseYear = year;
  }
}
