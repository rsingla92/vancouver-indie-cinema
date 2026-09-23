import { DateTime } from "luxon";

export const VANCOUVER_TZ = "America/Vancouver";

const PARSE_OPTIONS = { zone: VANCOUVER_TZ, locale: "en-CA" } as const;

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
 * Parse a venue-local date/time string with one of the given Luxon formats.
 *
 * - Formats that already contain a year token are parsed verbatim.
 * - Otherwise the year is inferred relative to `reference` (or fixed with `year`).
 *   Candidate years are validated by Luxon, so a weekday token such as "Sat"
 *   rejects years where the weekday does not line up.
 */
export function parseDateTime(
  value: string,
  formats: string[],
  options: { year?: number; reference?: DateTime } = {},
): DateTime {
  const reference = options.reference ?? DateTime.now().setZone(VANCOUVER_TZ);
  const candidateYears = options.year !== undefined
    ? [options.year]
    : [reference.year - 1, reference.year, reference.year + 1];

  for (const format of formats) {
    if (formatHasYear(format)) {
      const parsed = DateTime.fromFormat(value, format, PARSE_OPTIONS);
      if (parsed.isValid) return parsed;
      continue;
    }

    const valid = candidateYears
      .map((year) => DateTime.fromFormat(`${value} ${year}`, `${format} yyyy`, PARSE_OPTIONS))
      .filter((parsed) => parsed.isValid);
    if (valid.length === 0) continue;

    return valid.find((parsed) => parsed.year === inferYear(parsed.month, reference)) ?? valid[0]!;
  }

  throw new Error(`Unable to parse Vancouver date/time: ${value}`);
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
