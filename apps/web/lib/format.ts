export const VANCOUVER_TZ = "America/Vancouver";

const clock = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: VANCOUVER_TZ });
const day = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: VANCOUVER_TZ });
const longDay = new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: VANCOUVER_TZ });
const dateKey = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: VANCOUVER_TZ });

/** "6:00 PM" in Vancouver time. */
export function formatClock(value: string | Date): string {
  return clock.format(new Date(value)).replace(/ /g, " ");
}

/** "Wed, Sep 23" in Vancouver time. */
export function formatDay(value: string | Date): string {
  return day.format(new Date(value));
}

/** "Wednesday, September 23, 2026" in Vancouver time. */
export function formatLongDay(value: string | Date): string {
  return longDay.format(new Date(value));
}

/** "2026-09-23": the Vancouver calendar date an instant falls on. */
export function vancouverDateKey(value: string | Date): string {
  return dateKey.format(new Date(value));
}
