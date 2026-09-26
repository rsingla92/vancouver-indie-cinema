import { describe, expect, it, vi } from "vitest";
import type { ExtractedShowtime } from "../src/contracts.js";
import type { NormalizedTitle, TmdbMovie } from "../src/normalization/contracts.js";
import { processShowtime, stablePayloadHash } from "../src/normalization/pipeline.js";
import type { MergeInput, MergeResult } from "../src/normalization/repository.js";

const item: ExtractedShowtime = {
  venueSlug: "rio-theatre", sourceUid: "1", rawTitle: "Tony", startsAt: "2026-09-22T18:30:00-07:00",
  detailUrl: "https://riotheatre.ca/movie/tony/", status: "scheduled", tags: [],
  sourcePayload: { id: 1, event: { id: 2, title: "Tony", link: "https://riotheatre.ca/movie/tony/" } },
};
const normalized = (overrides: Partial<NormalizedTitle> = {}): NormalizedTitle => ({ coreTitle: "Tony", releaseYear: null, contentKind: "film", tags: [], confidence: 0.96, note: "", ...overrides });
const tmdbMovie: TmdbMovie = { id: 7, title: "Tony", original_title: "Tony", release_date: "2009-01-01", overview: "", poster_path: null, backdrop_path: null, genre_ids: [], popularity: 5 };

describe("stablePayloadHash", () => {
  it("ignores key order at every depth", () => {
    const reordered = { ...item, sourcePayload: { event: { link: "https://riotheatre.ca/movie/tony/", title: "Tony", id: 2 }, id: 1 } };
    expect(stablePayloadHash(reordered)).toBe(stablePayloadHash(item));
  });

  it("changes when nested source data or observed fields change", () => {
    const renamed = { ...item, sourcePayload: { id: 1, event: { id: 2, title: "Tony (Director's Cut)", link: "https://riotheatre.ca/movie/tony/" } } };
    expect(stablePayloadHash(renamed)).not.toBe(stablePayloadHash(item));
    expect(stablePayloadHash({ ...item, startsAt: "2026-09-22T20:30:00-07:00" })).not.toBe(stablePayloadHash(item));
    expect(stablePayloadHash({ ...item, status: "sold_out" })).not.toBe(stablePayloadHash(item));
  });
});

describe("processShowtime", () => {
  const dependencies = (result: NormalizedTitle, movies: TmdbMovie[] = []) => {
    const search = vi.fn(async () => movies);
    const merge = vi.fn(async (_input: MergeInput) => ({ status: "review" as const, showtimeId: null }));
    return { deps: { normalizer: { normalize: () => result }, tmdb: { search }, repository: { merge }, rulesVersion: "test" }, search, merge };
  };

  it("matches confident film titles and records the run", async () => {
    const { deps, search, merge } = dependencies(normalized({ releaseYear: 2009 }), [tmdbMovie]);
    await processShowtime(item, deps, { ingestionRunId: "run-1" });
    expect(search).toHaveBeenCalledOnce();
    expect(merge).toHaveBeenCalledWith(expect.objectContaining({ candidate: expect.objectContaining({ movie: tmdbMovie }), ingestionRunId: "run-1", rulesVersion: "test" }));
    expect(merge.mock.calls[0]?.[0]).not.toHaveProperty("refusal");
  });

  it("links a pinned title without searching", async () => {
    const { deps, search, merge } = dependencies(normalized({ coreTitle: "Suspiria" }), []);
    const movie = vi.fn(async (id: number) => ({ ...tmdbMovie, id, title: "Suspiria" }));
    await processShowtime({ ...item, rawTitle: "SUSPIRIA (4K)" }, { ...deps, tmdb: { search, movie } }, { overrides: new Map([["suspiria", 11906]]) });
    expect(search).not.toHaveBeenCalled();
    expect(movie).toHaveBeenCalledWith(11906);
    expect(merge).toHaveBeenCalledWith(expect.objectContaining({ candidate: expect.objectContaining({ movie: expect.objectContaining({ id: 11906 }), reason: "pinned to TMDB 11906 by title_overrides" }) }));
  });

  it("passes the venue's search languages to TMDB", async () => {
    const { deps, search } = dependencies(normalized(), [tmdbMovie]);
    await processShowtime(item, deps, { languages: ["en-CA", "fr-CA"] });
    expect(search).toHaveBeenCalledWith(expect.anything(), ["en-CA", "fr-CA"]);
  });

  it("uses the year the venue printed when the title has none, and records why a match was refused", async () => {
    const { deps, search, merge } = dependencies(normalized({ releaseYear: null }), [tmdbMovie]);
    await processShowtime({ ...item, releaseYear: 2009 }, deps);
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ releaseYear: 2009 }), undefined);
    expect(merge).toHaveBeenCalledWith(expect.objectContaining({ normalized: expect.objectContaining({ releaseYear: 2009 }) }));

    const refused = dependencies(normalized({ releaseYear: null }), []);
    await processShowtime(item, refused.deps);
    expect(refused.merge).toHaveBeenCalledWith(expect.objectContaining({ candidate: null, refusal: "refused: TMDB returned no candidates" }));
    const skipped = dependencies(normalized({ contentKind: "non_film" }), []);
    await processShowtime(item, skipped.deps);
    expect(skipped.merge).toHaveBeenCalledWith(expect.objectContaining({ refusal: "not searched: non_film" }));
  });

  it("retries a failed match with the title after a series label, and keeps the failure otherwise", async () => {
    const paraNorman: TmdbMovie = { ...tmdbMovie, id: 9, title: "ParaNorman", original_title: "ParaNorman", release_date: "2012-08-17" };
    const search = vi.fn(async (input: NormalizedTitle) => (input.coreTitle === "ParaNorman" ? [paraNorman] : []));
    const merge = vi.fn(async (_input: MergeInput): Promise<MergeResult> => ({ status: "review", showtimeId: null }));
    await processShowtime({ ...item, rawTitle: "Klassic Kidz: ParaNorman" }, { normalizer: { normalize: () => normalized({ coreTitle: "Klassic Kidz: ParaNorman" }) }, tmdb: { search }, repository: { merge }, rulesVersion: "test" });
    expect(search).toHaveBeenCalledTimes(2);
    expect(merge).toHaveBeenCalledWith(expect.objectContaining({ candidate: expect.objectContaining({ movie: paraNorman }), normalized: expect.objectContaining({ coreTitle: "ParaNorman", note: expect.stringMatching(/series label dropped/) }) }));

    const none = dependencies(normalized({ coreTitle: "Klassic Kidz: ParaNorman" }), []);
    await processShowtime(item, none.deps);
    expect(none.search).toHaveBeenCalledTimes(2);
    expect(none.merge).toHaveBeenCalledWith(expect.objectContaining({ candidate: null, normalized: expect.objectContaining({ coreTitle: "Klassic Kidz: ParaNorman" }) }));
  });

  it("asks OMDb only when TMDB has nothing close, and hands what it finds to the listing", async () => {
    const found = { imdbId: "tt1", title: "Tony", year: 2009, posterUrl: "https://m.media-amazon.com/images/tony.jpg", plot: "A loner drifts through London." };
    const none = dependencies(normalized(), []);
    const lookup = vi.fn(async () => found);
    await processShowtime(item, { ...none.deps, omdb: { enabled: true, lookup } });
    expect(lookup).toHaveBeenCalledWith(expect.objectContaining({ coreTitle: "Tony" }));
    expect(none.merge).toHaveBeenCalledWith(expect.objectContaining({
      candidate: null,
      details: { imageUrl: "https://m.media-amazon.com/images/tony.jpg", synopsis: "A loner drifts through London." },
      refusal: 'refused: TMDB returned no candidates; OMDb has "Tony" (2009, tt1)',
    }));

    const empty = dependencies(normalized(), []);
    await processShowtime(item, { ...empty.deps, omdb: { enabled: true, lookup: vi.fn(async () => null) } });
    expect(empty.merge).toHaveBeenCalledWith(expect.objectContaining({ candidate: null, refusal: "refused: TMDB returned no candidates; OMDb has nothing" }));
    expect(empty.merge.mock.calls[0]?.[0]).not.toHaveProperty("details");

    // Two films share the title: TMDB knows the film, it just cannot choose, so OMDb is not asked.
    const twin: TmdbMovie = { ...tmdbMovie, id: 8, release_date: "2013-01-01" };
    const ambiguous = dependencies(normalized(), [tmdbMovie, twin]);
    const unasked = vi.fn(async () => found);
    await processShowtime(item, { ...ambiguous.deps, omdb: { enabled: true, lookup: unasked } });
    expect(ambiguous.merge).toHaveBeenCalledWith(expect.objectContaining({ candidate: null, refusal: expect.stringMatching(/^refused: best .* are within/) }));
    expect(unasked).not.toHaveBeenCalled();

    // Neither for a match, a non-film, nor without a key.
    const matched = dependencies(normalized({ releaseYear: 2009 }), [tmdbMovie]);
    await processShowtime(item, { ...matched.deps, omdb: { enabled: true, lookup: unasked } });
    const skipped = dependencies(normalized({ contentKind: "non_film" }), []);
    await processShowtime(item, { ...skipped.deps, omdb: { enabled: true, lookup: unasked } });
    const disabled = dependencies(normalized(), []);
    await processShowtime(item, { ...disabled.deps, omdb: { enabled: false, lookup: unasked } });
    expect(unasked).not.toHaveBeenCalled();
    expect(disabled.merge).toHaveBeenCalledWith(expect.objectContaining({ refusal: "refused: TMDB returned no candidates" }));
  });

  it("skips TMDB for non-film and low-confidence titles", async () => {
    for (const result of [normalized({ contentKind: "non_film" }), normalized({ confidence: 0.45 })]) {
      const { deps, search, merge } = dependencies(result, [tmdbMovie]);
      await processShowtime(item, deps);
      expect(search).not.toHaveBeenCalled();
      expect(merge).toHaveBeenCalledWith(expect.objectContaining({ candidate: null }));
      expect(merge.mock.calls[0]?.[0]).not.toHaveProperty("ingestionRunId");
    }
  });
});
