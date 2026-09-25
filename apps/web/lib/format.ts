export const VANCOUVER_TZ = "America/Vancouver";

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(kind: string, timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${kind}:${timeZone}`;
  let cached = formatters.get(key);
  if (!cached) {
    cached = new Intl.DateTimeFormat(kind === "clock" ? "en-US" : "en-CA", { ...options, timeZone });
    formatters.set(key, cached);
  }
  return cached;
}

/** "6:00 PM" in the given zone. */
export function formatClock(value: string | Date, timeZone = VANCOUVER_TZ): string {
  return formatter("clock", timeZone, { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(value)).replace(/ /g, " ");
}

/** "Wed, Sep 23" in the given zone. */
export function formatDay(value: string | Date, timeZone = VANCOUVER_TZ): string {
  return formatter("day", timeZone, { weekday: "short", month: "short", day: "numeric" }).format(new Date(value));
}

/** "Wednesday, September 23, 2026" in the given zone. */
export function formatLongDay(value: string | Date, timeZone = VANCOUVER_TZ): string {
  return formatter("longDay", timeZone, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(value));
}

/** "2026-09-23": the calendar date an instant falls on in the given zone. */
export function dateKey(value: string | Date, timeZone = VANCOUVER_TZ): string {
  return formatter("dateKey", timeZone, { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

/** "October 2026" for a "2026-10" key. */
export function formatMonth(key: string): string {
  const [year, month] = key.split("-").map(Number) as [number, number];
  return formatter("month", "UTC", { month: "long", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

/** Kept for callers that only ever deal with Vancouver. */
export const vancouverDateKey = (value: string | Date): string => dateKey(value, VANCOUVER_TZ);
