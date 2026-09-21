import { describe, expect, it } from "vitest";
import { confidentMatch, rankCandidates, titleSimilarity } from "../src/normalization/tmdb.js";
import type { NormalizedTitle, TmdbMovie } from "../src/normalization/contracts.js";
import { DeterministicTitleNormalizer } from "../src/normalization/normalizer.js";


const input: NormalizedTitle = { coreTitle: "Stop Making Sense", releaseYear: 1984, contentKind: "film", tags: ["restoration"], confidence: 0.96, note: "Remastered label removed" };
const movie = (id: number, title: string, year: string, popularity = 20): TmdbMovie => ({ id, title, original_title: title, release_date: `${year}-01-01`, overview: "", poster_path: null, backdrop_path: null, genre_ids: [], popularity });

describe("deterministic title normalization", () => {
  const normalizer = new DeterministicTitleNormalizer();

  it("removes promotion and format labels", () => {
    expect(normalizer.normalize("Special Event: Stop Making Sense (Remastered) - 35mm")).toMatchObject({
      coreTitle: "Stop Making Sense",
      tags: expect.arrayContaining(["35mm", "restoration"]),
      contentKind: "film",
    });
  });

  it("extracts an explicit release year", () => {
    expect(normalizer.normalize("In the Mood for Love (2000) – 4K Restoration").releaseYear).toBe(2000);
  });

  it("does not send non-film events to movie matching", () => {
    expect(normalizer.normalize("Friday Night Live Comedy Night").contentKind).toBe("non_film");
  });
});


describe("TMDB matching", () => {
  it("treats punctuation and case as equivalent", () => expect(titleSimilarity("AMÉLIE", "Amelie")).toBe(1));
  it("selects an exact title and year", () => {
    const match = confidentMatch(rankCandidates(input, [movie(1, "Stop Making Sense", "1984"), movie(2, "Making Sense", "2020")]));
    expect(match?.movie.id).toBe(1);
    expect(match?.score).toBeGreaterThan(0.9);
  });
  it("refuses ambiguous candidates", () => {
    const ranked = rankCandidates({ ...input, releaseYear: null }, [movie(1, "Stop Making Sense", "1984", 10), movie(2, "Stop Making Sense", "2023", 10)]);
    expect(confidentMatch(ranked)).toBeNull();
  });
});
