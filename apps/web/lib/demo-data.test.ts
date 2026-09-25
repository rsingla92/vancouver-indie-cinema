import { describe, expect, it } from "vitest";
import { getDemoShowtimes, vancouverTime } from "./demo-data";

const vancouverClock = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Vancouver", hourCycle: "h23", hour: "2-digit", minute: "2-digit", month: "2-digit", day: "2-digit" });

describe("vancouverTime", () => {
  it("lands on the requested Vancouver wall-clock time in summer and winter", () => {
    const summer = vancouverTime(0, 18, 30, new Date("2026-07-01T20:00:00Z"));
    expect(summer.toISOString()).toBe("2026-07-02T01:30:00.000Z");
    expect(vancouverClock.format(summer)).toContain("18:30");

    const winter = vancouverTime(1, 21, 0, new Date("2026-01-10T05:00:00Z"));
    expect(winter.toISOString()).toBe("2026-01-11T05:00:00.000Z");
    expect(vancouverClock.format(winter)).toBe("01-10, 21:00");
  });
});

describe("getDemoShowtimes", () => {
  it("returns ISO timestamps sorted by start time", () => {
    const showtimes = getDemoShowtimes(new Date("2026-09-23T12:00:00Z"));
    expect(showtimes.length).toBeGreaterThan(0);
    expect(showtimes.every((item) => !Number.isNaN(Date.parse(item.startsAt)))).toBe(true);
    expect(showtimes.map((item) => item.startsAt)).toEqual([...showtimes.map((item) => item.startsAt)].sort());
  });
});
