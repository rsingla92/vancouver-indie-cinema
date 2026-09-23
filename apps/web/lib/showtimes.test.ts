import { describe, expect, it } from "vitest";
import { getDemoShowtimes } from "./demo-data";
import { firstShowtimePerMovie, matchesQuery } from "./showtimes";

describe("firstShowtimePerMovie", () => {
  it("keeps the earliest showtime for a film screened more than once", () => {
    const showtimes = getDemoShowtimes(new Date("2026-09-23T12:00:00Z"));
    const perfectDays = showtimes.filter((item) => item.movieId === "perfect-days");
    expect(perfectDays.length).toBeGreaterThan(1);

    const movies = firstShowtimePerMovie(showtimes);
    expect(movies.filter((item) => item.movieId === "perfect-days")).toEqual([perfectDays[0]]);
    expect(movies.map((item) => item.movieId)).toEqual([...new Set(showtimes.map((item) => item.movieId))]);
  });
});

describe("matchesQuery", () => {
  const [item] = getDemoShowtimes(new Date("2026-09-23T12:00:00Z"));
  it("matches title or cinema, ignoring case and surrounding whitespace", () => {
    expect(matchesQuery(item!, "")).toBe(true);
    expect(matchesQuery(item!, "  PERFECT ")).toBe(true);
    expect(matchesQuery(item!, "viff")).toBe(true);
    expect(matchesQuery(item!, "shining")).toBe(false);
  });
});
