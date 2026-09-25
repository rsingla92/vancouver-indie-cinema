import { describe, expect, it } from "vitest";
import { getDemoShowtimes } from "./demo-data";
import { citiesOf, firstShowtimePerMovie, inWindow, listingsOf, matchesQuery, shortSynopsis, theatresOf, upcoming, windowsOf } from "./showtimes";

const now = new Date("2026-09-23T12:00:00Z");
const showtimes = getDemoShowtimes(now);

describe("upcoming", () => {
  it("drops showtimes that have already started", () => {
    const later = new Date(Date.parse(showtimes[1]!.startsAt) + 1);
    const remaining = upcoming(showtimes, later);
    expect(remaining).toHaveLength(showtimes.length - 2);
    expect(remaining[0]).toBe(showtimes[2]);
  });
});

describe("firstShowtimePerMovie", () => {
  it("keeps the earliest showtime for a film screened more than once", () => {
    const perfectDays = showtimes.filter((item) => item.movieId === "perfect-days");
    expect(perfectDays.length).toBeGreaterThan(1);

    const movies = firstShowtimePerMovie(showtimes);
    expect(movies.filter((item) => item.movieId === "perfect-days")).toEqual([perfectDays[0]]);
    expect(movies.map((item) => item.movieId)).toEqual([...new Set(showtimes.map((item) => item.movieId))]);
  });
});

describe("theatresOf and citiesOf", () => {
  it("list distinct theatres in order and cities alphabetically", () => {
    expect(theatresOf(showtimes).map((theatre) => theatre.slug)).toEqual(["viff-centre", "the-cinematheque", "rio-theatre", "park-theatre", "hollywood-theatre"]);
    expect(citiesOf(showtimes)).toEqual(["Vancouver"]);
    const withToronto = [...showtimes, { ...showtimes[0]!, id: "t", theatre: { slug: "revue", name: "Revue Cinema", city: "Toronto", timezone: "America/Toronto" } }];
    expect(citiesOf(withToronto)).toEqual(["Toronto", "Vancouver"]);
  });
});

describe("matchesQuery", () => {
  const [item] = showtimes;
  it("matches title or cinema, ignoring case and surrounding whitespace", () => {
    expect(matchesQuery(item!, "")).toBe(true);
    expect(matchesQuery(item!, "  PERFECT ")).toBe(true);
    expect(matchesQuery(item!, "viff")).toBe(true);
    expect(matchesQuery(item!, "shining")).toBe(false);
  });
});

describe("shortSynopsis", () => {
  const long = "When Lord Murashige rises up against the tyrannical Oda, he finds himself besieged within the walls of his own castle. Isolated, he is confronted with a series of mysterious crimes that shatter the fragile order of his court, plunging the fortress into fear and suspicion. With Oda's army closing in, Murashige must outwit his enemies.";

  it("returns a short synopsis unchanged", () => {
    expect(shortSynopsis("A quiet film.")).toBe("A quiet film.");
  });

  it("keeps whole sentences that fit", () => {
    expect(shortSynopsis(long)).toBe("When Lord Murashige rises up against the tyrannical Oda, he finds himself besieged within the walls of his own castle.");
    expect(shortSynopsis(long, 300)).toMatch(/suspicion\.$/);
  });

  it("cuts a single long sentence at a word", () => {
    const sentence = "word ".repeat(80).trim();
    const short = shortSynopsis(sentence, 50);
    expect(short.length).toBeLessThanOrEqual(50);
    expect(short).toMatch(/^(?:word )+word…$/);
  });
});

describe("date windows", () => {
  const tz = "America/Vancouver";
  const at = (iso: string) => ({ ...showtimes[0]!, startsAt: iso });

  it("offers rolling ranges, each month in the data, and everything", () => {
    const items = [at("2026-09-28T19:00:00-07:00"), at("2026-10-03T19:00:00-07:00"), at("2026-11-20T19:00:00-08:00")];
    expect(windowsOf(items, tz).map((window) => window.label)).toEqual(["Next 7 days", "Next 30 days", "September 2026", "October 2026", "November 2026", "All dates"]);
  });

  it("counts calendar days in the venue's zone, today included", () => {
    const tonight = new Date("2026-09-25T23:30:00-07:00");
    expect(inWindow(at("2026-10-01T19:00:00-07:00"), "7d", tonight, tz)).toBe(true);
    expect(inWindow(at("2026-10-02T19:00:00-07:00"), "7d", tonight, tz)).toBe(false);
    expect(inWindow(at("2026-10-24T19:00:00-07:00"), "30d", tonight, tz)).toBe(true);
    expect(inWindow(at("2026-10-25T19:00:00-07:00"), "30d", tonight, tz)).toBe(false);
    expect(inWindow(at("2026-10-25T19:00:00-07:00"), "2026-10", tonight, tz)).toBe(true);
    expect(inWindow(at("2026-11-01T19:00:00-07:00"), "2026-10", tonight, tz)).toBe(false);
    expect(inWindow(at("2027-03-01T19:00:00-08:00"), "all", tonight, tz)).toBe(true);
  });
});

describe("listingsOf", () => {
  it("groups each film's screenings by day, in first-screening order, and pools their tags", () => {
    const listings = listingsOf(showtimes, "America/Vancouver");
    expect(listings.map((listing) => listing.film.movieId)).toEqual(firstShowtimePerMovie(showtimes).map((item) => item.movieId));
    const perfectDays = listings.find((listing) => listing.film.movieId === "perfect-days")!;
    expect(perfectDays.days).toHaveLength(2);
    expect(perfectDays.days.map((day) => day.showtimes.length)).toEqual([1, 1]);
    expect(perfectDays.days[0]!.label).toMatch(/^[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}$/);
    expect(listings.find((listing) => listing.film.movieId === "stop-making-sense")!.tags).toEqual(["4K restoration"]);
  });
});
