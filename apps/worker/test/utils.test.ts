import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { addPrintedYears, inferYear, parseDateTime, printedYear } from "../src/extractors/utils.js";

const reference = (iso: string) => DateTime.fromISO(iso, { zone: "America/Vancouver" });

describe("inferYear", () => {
  it("looks forward across the new year", () => {
    expect(inferYear(1, reference("2026-11-15"))).toBe(2027);
    expect(inferYear(12, reference("2026-11-15"))).toBe(2026);
  });

  it("treats the recent past as this year", () => {
    expect(inferYear(6, reference("2026-09-15"))).toBe(2026);
  });
});

describe("parseDateTime", () => {
  it("infers the year from the reference date", () => {
    expect(parseDateTime("Jan 3 7:00 pm", ["LLL d h:mm a"], { reference: reference("2026-12-20") }).toISO()).toBe("2027-01-03T19:00:00.000-08:00");
  });

  it("uses a weekday token to disambiguate the year", () => {
    // Jan 2 is a Saturday in 2027 but a Friday in 2026.
    expect(parseDateTime("Sat Jan 2 7:00 pm", ["ccc LLL d h:mm a"], { reference: reference("2026-12-28") }).toISO()).toBe("2027-01-02T19:00:00.000-08:00");
    expect(parseDateTime("Sat Sep 26 6:10 pm", ["ccc LLL d h:mm a"], { reference: reference("2026-09-21") }).toISO()).toBe("2026-09-26T18:10:00.000-07:00");
    // Dec 31 is a Thursday in 2026 and a Friday in 2027; seen in early January the Thursday is last week's.
    expect(parseDateTime("Thu Dec 31 9:00 pm", ["ccc LLL d h:mm a"], { reference: reference("2027-01-03") }).toISO()).toBe("2026-12-31T21:00:00.000-08:00");
  });

  it("rejects a weekday that only fits a date far from the reference", () => {
    // September 22 is a Monday in 2025 but the listing was seen in September 2026.
    expect(() => parseDateTime("Mon Sep 22 7:00 pm", ["ccc LLL d h:mm a"], { reference: reference("2026-09-21") })).toThrow(/Unable to parse/);
    // With a fallback format the same input still yields a date near the reference.
    expect(parseDateTime("Sep 22 7:00 pm", ["LLL d h:mm a"], { reference: reference("2026-09-21") }).year).toBe(2026);
  });

  it("keeps a year that the format parses explicitly", () => {
    expect(parseDateTime("March 1 2027 7:00 pm", ["LLLL d yyyy h:mm a"], { reference: reference("2026-09-15") }).year).toBe(2027);
  });

  it("parses in another zone when asked, with the same year inference", () => {
    const toronto = parseDateTime("Sat Jan 2 7:00 pm", ["ccc LLL d h:mm a"], { reference: reference("2026-12-28"), zone: "America/Toronto" });
    expect(toronto.toISO()).toBe("2027-01-02T19:00:00.000-05:00");
    expect(toronto.zoneName).toBe("America/Toronto");
    expect(() => parseDateTime("nope", ["LLL d h:mm a"], { zone: "America/Toronto" })).toThrow(/America\/Toronto date\/time/);
  });

  it("honours a fixed year option", () => {
    expect(parseDateTime("September 22 7:00 pm", ["LLLL d h:mm a"], { year: 2026 }).toISO()).toBe("2026-09-22T19:00:00.000-07:00");
  });

  it("falls through formats and reports unparseable input", () => {
    expect(parseDateTime("Sep 26 6:10 pm", ["ccc LLL d h:mm a", "LLL d h:mm a"], { reference: reference("2026-09-21") }).day).toBe(26);
    expect(() => parseDateTime("sometime soon", ["LLL d h:mm a"])).toThrow(/Unable to parse/);
  });
});

describe("printedYear", () => {
  it("reads a year beside a director credit or a running time, and nothing else", () => {
    expect(printedYear("Japan 1962. Dir: Masaki Kobayashi. 133 min.", 2027)).toBe(1962);
    expect(printedYear("Canada, 2026, 94 min", 2027)).toBe(2026);
    expect(printedYear("USA | 1990 | 113 min | Directed by Paul Verhoeven", 2027)).toBe(1990);
    expect(printedYear("2001: A Space Odyssey — USA, 1968, 149 min", 2027)).toBe(1968);
    expect(printedYear("VIFF 2026 · Sat Sep 26 · 6:10 pm", 2027)).toBeNull();
    expect(printedYear("Coming 2031, 120 min", 2027)).toBeNull();
  });

  it("fills in years from each film's page once, silently skipping pages it cannot read", async () => {
    const showtime = (id: string, detailUrl: string, releaseYear?: number) => ({
      venueSlug: "rio-theatre" as const, sourceUid: id, rawTitle: "Film", startsAt: "2026-09-26T19:00:00-07:00", detailUrl, status: "scheduled" as const, tags: [], sourcePayload: {},
      ...(releaseYear ? { releaseYear } : {}),
    });
    const showtimes = [showtime("1", "https://x/a"), showtime("2", "https://x/a"), showtime("3", "https://x/b", 1999), showtime("4", "https://x/c")];
    const fetched: string[] = [];
    await addPrintedYears(showtimes, async (url) => {
      fetched.push(url.pathname);
      if (url.pathname === "/c") throw new Error("boom");
      return "<html><body><p>Japan 1962. Dir: Masaki Kobayashi.</p></body></html>";
    }, { maxYear: 2027 });
    expect(fetched.sort()).toEqual(["/a", "/c"]);
    expect(showtimes.map((item) => item.releaseYear)).toEqual([1962, 1962, 1999, undefined]);
  });
});
