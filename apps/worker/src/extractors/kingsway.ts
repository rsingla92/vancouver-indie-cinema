import { load } from "cheerio";
import { DateTime } from "luxon";
import { extractedShowtimeSchema, type ExtractionBatch, type ExtractedShowtime } from "../contracts.js";
import { fetchText } from "../http.js";
import { cleanText, iso, parseDateTime, TORONTO_TZ } from "./utils.js";

/**
 * The Kingsway publishes one week at a time as plain text on a hand-made page
 * (its TLS certificate does not cover the domain, so the page is fetched over
 * http): a heading "Schedule starting Friday September 24 to Thursday October
 * 01" followed by lines such as "1:00 pm Filipinana (daily)" or "8:45 pm
 * Obsession (Fri Tues)". There are no ids and no online tickets, so the id is
 * the title and start time and the detail link is the schedule page itself.
 */
export const KINGSWAY_SCHEDULE_URL = "http://kingswaymovies.ca/new.html";

const HEADING = /schedule\s+starting\s+(\w+\s+\w+\s+\d{1,2})\s+to\s+(\w+\s+\w+\s+\d{1,2})/i;
const LINE = /^(\d{1,2}:\d{2}\s*[ap]\.?m\.?)\s+(.+?)\s*\(([^)]*)\)\s*$/i;
const WEEKDAYS: Record<string, number> = { mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6, sun: 7 };

/** "daily", "Sat Sun", "Fri / Mon to Thurs", "Mon-Wed" as ISO weekday numbers. */
export function parseDaySpec(spec: string): number[] {
  const text = spec.trim().toLowerCase();
  if (/^(daily|every\s*day|all\s*week)$/.test(text)) return [1, 2, 3, 4, 5, 6, 7];
  const days = new Set<number>();
  for (const part of text.split(/[\/,&+]|\band\b/)) {
    const range = part.trim().match(/^([a-z]+)\s*(?:to|-|–|through)\s*([a-z]+)$/);
    if (range) {
      const from = WEEKDAYS[range[1]!];
      const to = WEEKDAYS[range[2]!];
      if (from && to) for (let day = from; ; day = (day % 7) + 1) { days.add(day); if (day === to) break; }
      continue;
    }
    for (const token of part.trim().split(/\s+/)) {
      const day = WEEKDAYS[token.replace(/[^a-z]/g, "")];
      if (day) days.add(day);
    }
  }
  return [...days].sort((a, b) => a - b);
}

/**
 * "Friday September 24": the weekday and the date normally agree. When they do
 * not (the page has said "Friday September 24" for a week that began on Friday
 * the 25th), the weekday wins, because the week always runs Friday to Thursday
 * and a date one day off is the likelier typo.
 */
function parseWeekDay(value: string, reference: DateTime): DateTime {
  try {
    return parseDateTime(value, ["cccc LLLL d", "cccc LLL d"], { zone: TORONTO_TZ, reference }).startOf("day");
  } catch {
    const [weekday, ...rest] = value.split(/\s+/);
    const date = parseDateTime(rest.join(" "), ["LLLL d", "LLL d"], { zone: TORONTO_TZ, reference }).startOf("day");
    const wanted = DateTime.fromFormat(weekday!, "cccc", { locale: "en-CA" });
    if (!wanted.isValid) return date;
    const shift = ((wanted.weekday - date.weekday + 7) % 7);
    return date.plus({ days: shift <= 3 ? shift : shift - 7 });
  }
}

export interface ParsedKingswaySchedule {
  showtimes: ExtractedShowtime[];
  warnings: string[];
}

export function parseKingswaySchedule(html: string, pageUrl = KINGSWAY_SCHEDULE_URL, reference?: DateTime): ParsedKingswaySchedule {
  const now = reference ?? DateTime.now().setZone(TORONTO_TZ);
  const text = load(html.replace(/<br\s*\/?>/gi, "\n"))("body").text();
  const lines = text.split("\n").map((line) => cleanText(line)).filter(Boolean);
  // The heading wraps across lines on the page, so match it against the whole text.
  const heading = cleanText(text).match(HEADING);
  if (!heading) throw new Error("schedule page has no 'Schedule starting … to …' heading");
  const weekStart = parseWeekDay(heading[1]!, now);
  let weekEnd = parseWeekDay(heading[2]!, weekStart);
  if (weekEnd < weekStart) weekEnd = weekStart.plus({ days: 6 });

  const showtimes: ExtractedShowtime[] = [];
  const warnings: string[] = [];
  for (const line of lines) {
    const match = line.match(LINE);
    if (!match) continue;
    const [, clock, rawTitle, spec] = match;
    const time = DateTime.fromFormat(clock!.replace(/\./g, "").replace(/\s*([ap]m)$/i, " $1"), "h:mm a", { zone: TORONTO_TZ, locale: "en-CA" });
    const weekdays = parseDaySpec(spec!);
    if (!time.isValid || weekdays.length === 0) {
      warnings.push(`"${line}": unreadable time or days`);
      continue;
    }
    for (let day = weekStart; day <= weekEnd; day = day.plus({ days: 1 })) {
      if (!weekdays.includes(day.weekday)) continue;
      const startsAt = day.set({ hour: time.hour, minute: time.minute });
      showtimes.push(extractedShowtimeSchema.parse({
        venueSlug: "kingsway-theatre",
        sourceUid: `${rawTitle!.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}:${startsAt.toFormat("yyyy-MM-dd'T'HH:mm")}`,
        rawTitle: rawTitle!,
        startsAt: iso(startsAt),
        detailUrl: pageUrl,
        tags: [],
        sourcePayload: { line, days: spec, weekOf: weekStart.toISODate() },
      }));
    }
  }
  if (showtimes.length === 0) warnings.push(`${pageUrl}: no screenings parsed`);
  return { showtimes, warnings };
}

export async function extractKingsway(): Promise<ExtractionBatch> {
  const parsed = parseKingswaySchedule(await fetchText(new URL(KINGSWAY_SCHEDULE_URL)));
  return { venueSlug: "kingsway-theatre", fetchedAt: new Date().toISOString(), showtimes: parsed.showtimes, warnings: parsed.warnings };
}
