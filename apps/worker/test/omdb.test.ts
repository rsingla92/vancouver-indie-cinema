import { afterEach, describe, expect, it, vi } from "vitest";
import type { NormalizedTitle } from "../src/normalization/contracts.js";
import { OmdbClient, type LookupCache } from "../src/normalization/omdb.js";

const title = (overrides: Partial<NormalizedTitle> = {}): NormalizedTitle => ({ coreTitle: "Harakiri", releaseYear: 1962, contentKind: "film", tags: [], confidence: 0.96, note: "", ...overrides });
const harakiri = { Response: "True", Title: "Harakiri", Year: "1962", imdbID: "tt0056058", Type: "movie", Poster: "https://m.media-amazon.com/images/harakiri.jpg", Plot: "A ronin requests to commit seppuku." };

const requested: URL[] = [];
const params = (url: URL) => Object.fromEntries([...url.searchParams].filter(([key]) => key !== "apikey"));
function stubFetch(reply: (url: URL) => unknown) {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    requested.push(url);
    return new Response(JSON.stringify(reply(url)), { status: 200, headers: { "content-type": "application/json" } });
  }));
}
afterEach(() => { vi.unstubAllGlobals(); requested.length = 0; });

describe("OmdbClient", () => {
  it("does nothing without a key", async () => {
    stubFetch(() => harakiri);
    const client = new OmdbClient(undefined);
    expect(client.enabled).toBe(false);
    expect(await client.lookup(title())).toBeNull();
    expect(requested).toHaveLength(0);
  });

  it("asks by title and year, and takes an exact title with its poster and plot", async () => {
    stubFetch(() => harakiri);
    const client = new OmdbClient("key");
    expect(client.enabled).toBe(true);
    expect(await client.lookup(title())).toEqual({ imdbId: "tt0056058", title: "Harakiri", year: 1962, posterUrl: "https://m.media-amazon.com/images/harakiri.jpg", plot: "A ronin requests to commit seppuku." });
    expect(requested).toHaveLength(1);
    expect(requested[0]!.origin + requested[0]!.pathname).toBe("https://www.omdbapi.com/");
    expect(params(requested[0]!)).toEqual({ t: "Harakiri", y: "1962", plot: "short" });
    expect(requested[0]!.searchParams.get("apikey")).toBe("key");
  });

  it("refuses a near title, accepts an alternate one, and leaves out what OMDb marks N/A", async () => {
    stubFetch(() => ({ ...harakiri, Title: "Harakiri: Death of a Samurai", Year: "2011", imdbID: "tt1663645" }));
    expect(await new OmdbClient("key").lookup(title({ releaseYear: 2011 }))).toBeNull();

    stubFetch(() => ({ ...harakiri, Title: "Seppuku", Poster: "N/A", Plot: "N/A" }));
    expect(await new OmdbClient("key").lookup(title({ alternateTitles: ["Seppuku"] }))).toEqual({ imdbId: "tt0056058", title: "Seppuku", year: 1962 });
  });

  it("without a year, searches and takes the one exact film title, then its details", async () => {
    stubFetch((url) => url.searchParams.has("s")
      ? { Response: "True", Search: [
        { Title: "Tony", Year: "2009", imdbID: "tt1", Type: "movie", Poster: "N/A" },
        { Title: "Tony Manero", Year: "2008", imdbID: "tt2", Type: "movie", Poster: "N/A" },
        { Title: "Tony", Year: "2013", imdbID: "tt3", Type: "series", Poster: "N/A" },
      ] }
      : { Response: "True", Title: "Tony", Year: "2009", imdbID: "tt1", Type: "movie", Poster: "N/A", Plot: "A loner drifts through London." });
    expect(await new OmdbClient("key").lookup(title({ coreTitle: "Tony", releaseYear: null }))).toEqual({ imdbId: "tt1", title: "Tony", year: 2009, plot: "A loner drifts through London." });
    expect(requested.map(params)).toEqual([{ s: "Tony", type: "movie" }, { i: "tt1", plot: "short" }]);
  });

  it("gives up when a search finds no exact title, or more than one", async () => {
    stubFetch(() => ({ Response: "True", Search: [{ Title: "Tony", Year: "2009", imdbID: "tt1", Type: "movie", Poster: "N/A" }, { Title: "Tony", Year: "2013", imdbID: "tt4", Type: "movie", Poster: "N/A" }] }));
    expect(await new OmdbClient("key").lookup(title({ coreTitle: "Tony", releaseYear: null }))).toBeNull();
    expect(requested).toHaveLength(1);

    stubFetch(() => ({ Response: "False", Error: "Movie not found!" }));
    expect(await new OmdbClient("key").lookup(title({ coreTitle: "Nobody's Film", releaseYear: null }))).toBeNull();
    expect(await new OmdbClient("key").lookup(title({ coreTitle: "Nobody's Film", releaseYear: 2026 }))).toBeNull();
  });

  it("remembers answers, empty ones included, so a rerun costs no requests", async () => {
    const store = new Map<string, unknown>();
    const cache: LookupCache = {
      get: async (provider, key) => store.get(`${provider}:${key}`),
      set: async (provider, key, value) => { store.set(`${provider}:${key}`, value); },
    };
    stubFetch(() => ({ Response: "False", Error: "Movie not found!" }));
    const client = new OmdbClient("key", cache);
    expect(await client.lookup(title())).toBeNull();
    expect(await client.lookup(title())).toBeNull();
    expect(requested).toHaveLength(1);
    expect([...store.entries()]).toEqual([["omdb:harakiri|1962", null]]);

    store.set("omdb:harakiri|1962", { imdbId: "tt0056058", title: "Harakiri", year: 1962 });
    expect(await client.lookup(title())).toEqual({ imdbId: "tt0056058", title: "Harakiri", year: 1962 });
    expect(requested).toHaveLength(1);
  });

  it("reports a failed request rather than caching it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("slow down", { status: 429 })));
    const store = new Map<string, unknown>();
    const cache: LookupCache = { get: async () => undefined, set: async (provider, key, value) => { store.set(`${provider}:${key}`, value); } };
    await expect(new OmdbClient("key", cache).lookup(title())).rejects.toThrow("OMDb request failed (429)");
    expect(store.size).toBe(0);
  });
});
