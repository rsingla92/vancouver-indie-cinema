import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CARLTON_CINEMA, CINEMATHEQUE_QUEBECOISE, extractOmniWeb, parseOmniWebDay, readMovieData, readTitleLabels } from "../src/extractors/omniweb.js";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

describe("OmniWeb box office", () => {
  it("reads the Cinémathèque's performances with Montreal times, version tags and ticket links", () => {
    const { showtimes, dates, warnings } = parseOmniWebDay(CINEMATHEQUE_QUEBECOISE, fixture("omniweb-cinematheque.html"));
    expect(warnings).toEqual([]);
    expect(dates).toEqual(["2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29"]);
    expect(showtimes).toHaveLength(3);
    expect(showtimes[0]).toMatchObject({
      venueSlug: "cinematheque-quebecoise",
      sourceUid: "14212",
      rawTitle: "Maria Chapdelaine (VOSTA)",
      startsAt: "2026-09-25T19:30:00-04:00",
      detailUrl: "https://www.cinematheque.qc.ca/fr/programmation",
      ticketUrl: "https://omniwebticketing6.com/cinematheque/?schdate=2026-09-25&perfix=14212",
      status: "scheduled",
      tags: ["VOSTA"],
    });
    expect(showtimes[0]?.releaseYear).toBeUndefined();
    expect(showtimes[0]?.sourcePayload).toMatchObject({ auditorium: "SALLE 1", runTime: "1 hr 47 min" });
  });

  it("reads the Carlton's performances under its own slug and takes a bracketed year", () => {
    const { showtimes, warnings } = parseOmniWebDay(CARLTON_CINEMA, fixture("omniweb-carlton.html"));
    expect(warnings).toEqual([]);
    const clockwork = showtimes.filter((showtime) => showtime.rawTitle === "A Clockwork Orange (1971)");
    expect(clockwork.map((showtime) => showtime.startsAt)).toEqual(["2026-09-26T12:30:00-04:00", "2026-09-26T15:30:00-04:00", "2026-09-26T18:30:00-04:00", "2026-09-26T21:30:00-04:00"]);
    expect(clockwork[0]).toMatchObject({ venueSlug: "carlton-cinema", sourceUid: "140862", releaseYear: 1971, tags: [], ticketUrl: "https://omniwebticketing6.com/imaginecinemas/carlton/?schdate=2026-09-26&perfix=140862", detailUrl: "https://imaginecinemas.com/cinema/carlton/" });
    expect(showtimes.some((showtime) => showtime.rawTitle === "Ha-Chan, Shake Your Booty!")).toBe(true);
  });

  it("splits version labels and years off titles and decodes HTML entities", () => {
    expect(readTitleLabels("Kiki's Delivery Service (DUB) (1989)")).toEqual({ tags: ["DUB"], year: 1989 });
    expect(readTitleLabels("Maria Chapdelaine (VOSTA)")).toEqual({ tags: ["VOSTA"] });
    expect(readTitleLabels("Les perdants (VO-SME)")).toEqual({ tags: [] });
    expect(readTitleLabels("Dr. Strangelove (or How I Learned…) (1964)")).toEqual({ tags: [], year: 1964 });
    const html = fixture("omniweb-carlton.html").replace("A Clockwork Orange (1971)", "Kiki&apos;s Delivery Service &amp; Friends (DUB) (1989)");
    expect(parseOmniWebDay(CARLTON_CINEMA, html).showtimes.find((showtime) => showtime.rawTitle.startsWith("Kiki"))).toMatchObject({ rawTitle: "Kiki's Delivery Service & Friends (DUB) (1989)", tags: ["DUB"], releaseYear: 1989 });
  });

  it("marks a performance with no seats left sold out and skips one it cannot read", () => {
    const html = fixture("omniweb-cinematheque.html").replace(/"seatsRemaining":\s*"137"/, '"seatsRemaining": "0"').replace(/"curtainTime":\s*"2026-09-25 18:30"/, '"curtainTime": "soon"');
    const { showtimes, warnings } = parseOmniWebDay(CINEMATHEQUE_QUEBECOISE, html);
    expect(showtimes.find((showtime) => showtime.sourceUid === "14212")?.status).toBe("sold_out");
    expect(showtimes.find((showtime) => showtime.sourceUid === "14357")).toBeUndefined();
    expect(warnings).toEqual([expect.stringMatching(/performance curtainTime/)]);
    expect(() => readMovieData("<html></html>")).toThrow(/no gMovieData/);
  });

  describe("extractOmniWeb", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("asks for the first day, then every listed day inside the range, and reports a day it cannot read", async () => {
      const requested: string[] = [];
      vi.stubGlobal("fetch", vi.fn(async (input: URL | string) => {
        const url = new URL(String(input));
        requested.push(url.searchParams.get("schdate") ?? "");
        if (url.searchParams.get("schdate") === "2026-09-27") return new Response("gone", { status: 404 });
        return new Response(fixture("omniweb-cinematheque.html"));
      }));
      const batch = await extractOmniWeb(CINEMATHEQUE_QUEBECOISE, { start: new Date("2026-09-25T12:00:00Z"), end: new Date("2026-09-28T12:00:00Z") });
      expect(requested).toEqual(["2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28"]);
      // The stub serves the same day every time, so nothing new is added after the first page.
      expect(batch.showtimes).toHaveLength(3);
      expect(batch.warnings).toEqual([expect.stringMatching(/^2026-09-27: GET .* failed with 404/)]);
    });
  });
});
