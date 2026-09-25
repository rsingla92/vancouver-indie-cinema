import { describe, expect, it, vi } from "vitest";
import type { ExtractedShowtime } from "../src/contracts.js";
import type { NormalizedTitle, TmdbMovie } from "../src/normalization/contracts.js";
import { processShowtime, stablePayloadHash } from "../src/normalization/pipeline.js";
import type { MergeInput } from "../src/normalization/repository.js";

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

  it("uses the year the venue printed when the title has none, and records why a match was refused", async () => {
    const { deps, search, merge } = dependencies(normalized({ releaseYear: null }), [tmdbMovie]);
    await processShowtime({ ...item, releaseYear: 2009 }, deps);
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ releaseYear: 2009 }));
    expect(merge).toHaveBeenCalledWith(expect.objectContaining({ normalized: expect.objectContaining({ releaseYear: 2009 }) }));

    const refused = dependencies(normalized({ releaseYear: null }), []);
    await processShowtime(item, refused.deps);
    expect(refused.merge).toHaveBeenCalledWith(expect.objectContaining({ candidate: null, refusal: "refused: TMDB returned no candidates" }));
    const skipped = dependencies(normalized({ contentKind: "non_film" }), []);
    await processShowtime(item, skipped.deps);
    expect(skipped.merge).toHaveBeenCalledWith(expect.objectContaining({ refusal: "not searched: non_film" }));
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
