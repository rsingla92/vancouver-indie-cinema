import { describe, expect, it } from "vitest";
import { dateKey, formatClock, formatDay, formatLongDay, formatMonth, vancouverDateKey } from "./format";

// 2026-09-24T01:00Z is 6:00 PM on Wednesday, September 23 in Vancouver (PDT).
const instant = "2026-09-24T01:00:00.000Z";

describe("format helpers", () => {
  it("renders Vancouver wall-clock values by default", () => {
    expect(formatClock(instant)).toBe("6:00 PM");
    expect(formatDay(instant)).toBe("Wed, Sep 23");
    expect(formatLongDay(instant)).toBe("Wednesday, September 23, 2026");
    expect(vancouverDateKey(instant)).toBe("2026-09-23");
  });

  it("switches offsets across daylight saving", () => {
    expect(formatClock("2026-01-11T05:00:00.000Z")).toBe("9:00 PM");
    expect(dateKey("2026-01-11T05:00:00.000Z")).toBe("2026-01-10");
  });

  it("formats in another city's zone when asked", () => {
    expect(formatClock(instant, "America/Toronto")).toBe("9:00 PM");
    expect(dateKey("2026-09-24T03:30:00.000Z", "America/Toronto")).toBe("2026-09-23");
  });
});

describe("formatMonth", () => {
  it("labels a month key", () => {
    expect(formatMonth("2026-10")).toBe("October 2026");
    expect(formatMonth("2027-01")).toBe("January 2027");
  });
});
