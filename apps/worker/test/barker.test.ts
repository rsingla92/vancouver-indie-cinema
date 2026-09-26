import { afterEach, describe, expect, it, vi } from "vitest";
import { extractBarker, RIO_THEATRE } from "../src/extractors/barker.js";

const listing = (id: number) => ({ id, event: { id: id + 1000, title: `Film ${id}`, link: `https://riotheatre.ca/movie/film-${id}/` }, start_time: "2026-09-23T21:30:00-07:00", end_time: "", extra: "", premiere: false, tickets_link: "" });
const requested: URL[] = [];

afterEach(() => { vi.unstubAllGlobals(); requested.length = 0; });

function servePages(pages: unknown[][]) {
  vi.stubGlobal("fetch", vi.fn(async (input: URL | string) => {
    const url = new URL(String(input));
    requested.push(url);
    const page = Number(url.searchParams.get("page"));
    return Response.json(pages[page - 1] ?? []);
  }));
}

describe("extractBarker", () => {
  it("asks for Vancouver calendar dates even when it is already tomorrow in UTC", async () => {
    servePages([[listing(1)]]);
    // 19:00 PDT on Sep 23 is 02:00 UTC on Sep 24.
    const start = new Date("2026-09-24T02:00:00Z");
    await extractBarker(RIO_THEATRE, { start, end: new Date(start.getTime() + 10 * 86_400_000) });
    expect(requested[0]?.searchParams.get("start_date")).toBe("2026-09-23");
    expect(requested[0]?.searchParams.get("end_date")).toBe("2026-10-03");
  });

  it("follows pages until a short one and de-duplicates listings", async () => {
    servePages([[listing(1), listing(2)], [listing(2), listing(3)], [listing(4)]]);
    const batch = await extractBarker(RIO_THEATRE, { start: new Date("2026-09-23T12:00:00Z"), end: new Date("2026-10-23T12:00:00Z") }, { pageSize: 2 });
    expect(batch.showtimes.map((item) => item.sourceUid)).toEqual(["1", "2", "3", "4"]);
    expect(batch.warnings).toEqual([]);
    expect(requested.filter((url) => url.pathname.endsWith("/listings"))).toHaveLength(3);
  });

  it("warns when the endpoint keeps returning the same full page", async () => {
    servePages([[listing(1), listing(2)], [listing(1), listing(2)]]);
    const batch = await extractBarker(RIO_THEATRE, { start: new Date("2026-09-23T12:00:00Z"), end: new Date("2026-10-23T12:00:00Z") }, { pageSize: 2 });
    expect(batch.showtimes).toHaveLength(2);
    expect(batch.warnings[0]).toMatch(/may not paginate/);
  });

  it("warns when the page cap is reached", async () => {
    servePages([[listing(1), listing(2)], [listing(3), listing(4)], [listing(5), listing(6)]]);
    const batch = await extractBarker(RIO_THEATRE, { start: new Date("2026-09-23T12:00:00Z"), end: new Date("2026-10-23T12:00:00Z") }, { pageSize: 2, maxPages: 2 });
    expect(batch.showtimes).toHaveLength(4);
    expect(batch.warnings[0]).toMatch(/page cap/);
  });

  it("carries per-listing warnings through with the page number", async () => {
    servePages([[listing(1), { ...listing(2), event: { id: 1, title: "", link: "nope" } }]]);
    const batch = await extractBarker(RIO_THEATRE, { start: new Date("2026-09-23T12:00:00Z"), end: new Date("2026-10-23T12:00:00Z") });
    expect(batch.showtimes).toHaveLength(1);
    expect(batch.warnings[0]).toMatch(/^page 1 listing 1:/);
  });

  it("reads each event's page for the year the venue prints", async () => {
    servePages([[listing(1), listing(2)]]);
    const pages: string[] = [];
    const batch = await extractBarker(RIO_THEATRE, { start: new Date("2026-09-23T12:00:00Z"), end: new Date("2026-10-23T12:00:00Z") }, {
      fetchPage: async (url) => {
        pages.push(url.pathname);
        if (url.pathname.includes("film-2")) throw new Error("offline");
        return "<html><body><p>USA | 1990 | 113 min | Dir. Paul Verhoeven</p></body></html>";
      },
    });
    expect(pages.sort()).toEqual(["/movie/film-1/", "/movie/film-2/"]);
    expect(batch.showtimes.map((showtime) => showtime.releaseYear)).toEqual([1990, undefined]);
    expect(batch.warnings).toEqual([]);
  });
});
