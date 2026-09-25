import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CINEMA_BEAUBIEN,
  CINEMA_DU_MUSEE,
  CINEMA_DU_PARC,
  crawlCinemaCinema,
  decodeDevalue,
  extractCinemaCinema,
  parseCinemaCinemaSchedule,
} from "../src/extractors/cinemacinema.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/cinemacinema-schedule.json", import.meta.url), "utf8")) as unknown;

describe("decodeDevalue", () => {
  it("rebuilds objects, arrays, shared references and special values", () => {
    const decoded = decodeDevalue([{ a: 1, b: 2, again: 1, missing: -1, when: 4 }, [2, 3], "x", -0, ["Date", "2026-09-25T00:00:00.000Z"]]) as Record<string, unknown>;
    expect(decoded.a).toEqual(["x", -0]);
    expect(decoded.again).toBe(decoded.a);
    expect(decoded.missing).toBeUndefined();
    expect(decoded.when).toBeInstanceOf(Date);
  });
});

describe("cinemacinema.ca schedule", () => {
  const parsed = parseCinemaCinemaSchedule(fixture);

  it("reads every screening for the three cinemas with Montreal times and billetterie links", () => {
    expect(parsed.warnings).toEqual([]);
    expect(parsed.dates).toEqual(["2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29"]);
    const beaubien = parsed.showtimes.filter((showtime) => showtime.venueSlug === "cinema-beaubien");
    expect(beaubien[0]).toMatchObject({
      sourceUid: "51911",
      rawTitle: "PAULINE JULIEN : FEMME PAYS",
      startsAt: "2026-09-25T10:00:00-04:00",
      detailUrl: "https://cinemacinema.ca/en/films/pauline-julien-femme-pays-2116",
      ticketUrl: "https://billetterie.cinemabeaubien.com/US/movie-purchase.awp?P1=01&P2=01&P3=51911",
      tags: ["VOF"],
    });
    const parc = parsed.showtimes.find((showtime) => showtime.sourceUid === "50268");
    expect(parc).toMatchObject({ venueSlug: "cinema-du-parc", rawTitle: "PERFECT BLUE", startsAt: "2026-09-25T21:30:00-04:00", ticketUrl: "https://billetterie.cinemaduparc.com/US/movie-purchase.awp?P1=01&P2=02&P3=50268", tags: ["VOSTA"] });
    expect(parc?.sourcePayload).toMatchObject({ screeningTitle: "MINUIT: PERFECT BLUE" });
    expect(parsed.showtimes.find((showtime) => showtime.sourceUid === "52166")).toMatchObject({ venueSlug: "cinema-du-musee", ticketUrl: "https://billetterie.cinemadumusee.com/US/movie-purchase.awp?P1=01&P2=03&P3=52166" });
  });

  it("links a screening sold elsewhere to the address the site gives", () => {
    const festival = parsed.showtimes.filter((showtime) => showtime.rawTitle.startsWith("FESTIVAL INTERNATIONAL"));
    expect(festival.map((showtime) => showtime.venueSlug).sort()).toEqual(["cinema-du-musee", "cinema-du-musee", "cinema-du-parc"]);
    expect(festival.every((showtime) => showtime.ticketUrl?.startsWith("https://montrealblackfilm.com/event/"))).toBe(true);
  });

  it("skips a screening it cannot read and reports it", () => {
    const broken = structuredClone(fixture) as { nodes: { data: unknown[] }[] };
    const values = broken.nodes[2]!.data;
    // Point the 9:30 PM screening's start time at a value the parser cannot read.
    const screening = values.find((value) => typeof value === "object" && value !== null && values[(value as Record<string, number>).representation_id!] === 50268) as Record<string, number>;
    screening.heure_debut = values.push("half past nine") - 1;
    const { showtimes, warnings } = parseCinemaCinemaSchedule(broken);
    expect(showtimes.find((showtime) => showtime.sourceUid === "50268")).toBeUndefined();
    expect(warnings).toEqual([expect.stringMatching(/screening 50268: unreadable time/)]);
    expect(() => parseCinemaCinemaSchedule({ type: "data", nodes: [{ type: "data", data: [{}] }] })).toThrow(/no schedule node/);
  });
});

describe("crawlCinemaCinema", () => {
  const requested: string[] = [];
  afterEach(() => { vi.unstubAllGlobals(); requested.length = 0; });

  it("asks for today once, then for each listed day inside the range, and shares one crawl between venues", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: URL | string) => {
      const url = new URL(String(input));
      requested.push(url.search);
      if (url.searchParams.get("date") === "2026-09-27") return new Response("gone", { status: 404 });
      return Response.json(fixture);
    }));
    const range = { start: new Date("2026-09-25T12:00:00Z"), end: new Date("2026-09-28T12:00:00Z") };
    const crawl = await crawlCinemaCinema(range);
    expect(requested).toEqual(["", "?date=2026-09-26", "?date=2026-09-27", "?date=2026-09-28"]);
    expect(crawl.showtimes).toHaveLength(15);
    expect(crawl.warnings).toEqual([expect.stringMatching(/^2026-09-27: GET .* failed with 404/)]);

    let crawls = 0;
    const stub = async () => { crawls += 1; return crawl; };
    const [parc, beaubien, musee] = await Promise.all([
      extractCinemaCinema(CINEMA_DU_PARC, range, { crawl: stub }),
      extractCinemaCinema(CINEMA_BEAUBIEN, range, { crawl: stub }),
      extractCinemaCinema(CINEMA_DU_MUSEE, range, { crawl: stub }),
    ]);
    expect(crawls).toBe(1);
    expect(parc.showtimes.length + beaubien.showtimes.length + musee.showtimes.length).toBe(15);
    expect(parc.showtimes.every((showtime) => showtime.venueSlug === "cinema-du-parc")).toBe(true);
    expect(musee.warnings).toEqual(crawl.warnings);
  });
});
