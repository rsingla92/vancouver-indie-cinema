import type { ShowtimeView } from "./types";

export const VANCOUVER_TZ = "America/Vancouver";

const dateParts = new Intl.DateTimeFormat("en-CA", { timeZone: VANCOUVER_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const wallClockParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: VANCOUVER_TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
});

function partsOf(formatter: Intl.DateTimeFormat, date: Date): Record<string, number> {
  return Object.fromEntries(formatter.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
}

/** The instant that reads as `hour:minute` on the Vancouver wall clock, `dayOffset` days from `now`'s Vancouver date. */
export function vancouverTime(dayOffset: number, hour: number, minute = 0, now = new Date()): Date {
  const today = partsOf(dateParts, now);
  const guess = Date.UTC(today.year!, today.month! - 1, today.day! + dayOffset, hour, minute);
  const wall = partsOf(wallClockParts, new Date(guess));
  const wallAsUtc = Date.UTC(wall.year!, wall.month! - 1, wall.day!, wall.hour!, wall.minute!);
  return new Date(guess + (guess - wallAsUtc));
}

/**
 * Labelled preview listings shown when DATABASE_URL is not configured. Times are
 * generated per call so they always fall on the current Vancouver evening.
 */
export function getDemoShowtimes(now = new Date()): ShowtimeView[] {
  const at = (dayOffset: number, hour: number, minute = 0) => vancouverTime(dayOffset, hour, minute, now).toISOString();
  const showtimes: ShowtimeView[] = [
    { id: "demo-1", movieId: "perfect-days", title: "Perfect Days", year: 2023, synopsis: "A Tokyo toilet cleaner finds beauty in the rhythms of everyday life.", posterUrl: "https://image.tmdb.org/t/p/w500/mjEk5Wwx6TYVqw29zSaUHclMIgp.jpg", backdropUrl: "https://image.tmdb.org/t/p/w1280/2f1tvY8q6CcV6Z3DRKXWIIRcc3T.jpg", theatre: { slug: "viff-centre", name: "VIFF Centre" }, startsAt: at(0, 18), ticketUrl: "https://viff.org/", status: "scheduled", tags: [] },
    { id: "demo-2", movieId: "stop-making-sense", title: "Stop Making Sense", year: 1984, synopsis: "Jonathan Demme captures Talking Heads at their exhilarating peak.", posterUrl: "https://image.tmdb.org/t/p/w500/8Z9qq1wV9Z8JpU5JlXw3qLqXH4q.jpg", backdropUrl: "", theatre: { slug: "rio-theatre", name: "Rio Theatre" }, startsAt: at(0, 20), ticketUrl: "https://riotheatretickets.ca/", status: "scheduled", tags: ["4K restoration"] },
    { id: "demo-3", movieId: "in-the-mood-for-love", title: "In the Mood for Love", year: 2000, synopsis: "Two neighbours form an intimate bond after suspecting their spouses.", posterUrl: "https://image.tmdb.org/t/p/w500/iYypPT4bhqXfq1b6EnmxvRt6b2Y.jpg", backdropUrl: "", theatre: { slug: "the-cinematheque", name: "The Cinematheque" }, startsAt: at(0, 19, 30), ticketUrl: "https://thecinematheque.ca/", status: "sold_out", tags: ["35mm"] },
    { id: "demo-4", movieId: "the-shining", title: "The Shining", year: 1980, synopsis: "A family heads to an isolated hotel where a sinister presence awaits.", posterUrl: "https://image.tmdb.org/t/p/w500/xazWoLealQwEgqZ89MLZklLZD3k.jpg", backdropUrl: "", theatre: { slug: "hollywood-theatre", name: "Hollywood Theatre" }, startsAt: at(1, 21), ticketUrl: "https://www.hollywoodtheatre.ca/", status: "scheduled", tags: ["Late night"] },
    { id: "demo-5", movieId: "perfect-days", title: "Perfect Days", year: 2023, synopsis: "A Tokyo toilet cleaner finds beauty in the rhythms of everyday life.", posterUrl: "https://image.tmdb.org/t/p/w500/mjEk5Wwx6TYVqw29zSaUHclMIgp.jpg", backdropUrl: "https://image.tmdb.org/t/p/w1280/2f1tvY8q6CcV6Z3DRKXWIIRcc3T.jpg", theatre: { slug: "viff-centre", name: "VIFF Centre" }, startsAt: at(2, 15, 30), ticketUrl: "https://viff.org/", status: "scheduled", tags: [] },
  ];
  return showtimes.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
