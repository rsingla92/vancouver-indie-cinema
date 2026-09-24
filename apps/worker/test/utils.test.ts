import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { inferYear, parseDateTime } from "../src/extractors/utils.js";

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

  it("honours a fixed year option", () => {
    expect(parseDateTime("September 22 7:00 pm", ["LLLL d h:mm a"], { year: 2026 }).toISO()).toBe("2026-09-22T19:00:00.000-07:00");
  });

  it("falls through formats and reports unparseable input", () => {
    expect(parseDateTime("Sep 26 6:10 pm", ["ccc LLL d h:mm a", "LLL d h:mm a"], { reference: reference("2026-09-21") }).day).toBe(26);
    expect(() => parseDateTime("sometime soon", ["LLL d h:mm a"])).toThrow(/Unable to parse/);
  });
});
