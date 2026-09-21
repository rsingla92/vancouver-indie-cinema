import { DateTime } from "luxon";

export const VANCOUVER_TZ = "America/Vancouver";

export function cleanText(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function absoluteUrl(href: string, base: string): string {
  return new URL(href, base).toString();
}

export function inferYear(month: number, reference: DateTime): number {
  let year = reference.year;
  const distance = month - reference.month;
  if (distance < -6) year += 1;
  if (distance > 6) year -= 1;
  return year;
}

export function parseDateTime(
  value: string,
  formats: string[],
  options: { year?: number; reference?: DateTime } = {},
): DateTime {
  const reference = options.reference ?? DateTime.now().setZone(VANCOUVER_TZ);

  for (const format of formats) {
    let parsed = DateTime.fromFormat(value, format, {
      zone: VANCOUVER_TZ,
      locale: "en-CA",
    });
    if (!parsed.isValid) continue;
    parsed = parsed.set({ year: options.year ?? inferYear(parsed.month, reference) });
    return parsed;
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
