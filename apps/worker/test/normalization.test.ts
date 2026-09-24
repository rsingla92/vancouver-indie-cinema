import { describe, expect, it } from "vitest";
import { confidentMatch, rankCandidates, titleSimilarity } from "../src/normalization/tmdb.js";
import type { NormalizedTitle, TmdbMovie } from "../src/normalization/contracts.js";
import { DeterministicTitleNormalizer } from "../src/normalization/normalizer.js";

const input: NormalizedTitle = { coreTitle: "Stop Making Sense", releaseYear: 1984, contentKind: "film", tags: ["restoration"], confidence: 0.96, note: "Remastered label removed" };
const movie = (id: number, title: string, year: string, popularity = 20): TmdbMovie => ({ id, title, original_title: title, release_date: `${year}-01-01`, overview: "", poster_path: null, backdrop_path: null, genre_ids: [], popularity });

describe("deterministic title normalization", () => {
  const normalizer = new DeterministicTitleNormalizer(() => new Date("2026-09-23T00:00:00Z"));

  it("removes promotion and format labels", () => {
    expect(normalizer.normalize("Special Event: Stop Making Sense (Remastered) - 35mm")).toMatchObject({
      coreTitle: "Stop Making Sense",
      tags: expect.arrayContaining(["35mm", "restoration"]),
      contentKind: "film",
    });
  });

  it("extracts an explicit release year", () => {
    expect(normalizer.normalize("In the Mood for Love (2000) – 4K Restoration")).toMatchObject({ coreTitle: "In the Mood for Love", releaseYear: 2000 });
    expect(normalizer.normalize("Halloween (1978) 35mm")).toMatchObject({ coreTitle: "Halloween", releaseYear: 1978, tags: ["35mm"] });
    expect(normalizer.normalize("The Shining - 1980")).toMatchObject({ coreTitle: "The Shining", releaseYear: 1980 });
  });

  it("keeps numbers that belong to the title", () => {
    expect(normalizer.normalize("2001: A Space Odyssey")).toMatchObject({ coreTitle: "2001: A Space Odyssey", releaseYear: null });
    expect(normalizer.normalize("Blade Runner 2049")).toMatchObject({ coreTitle: "Blade Runner 2049", releaseYear: null });
    expect(normalizer.normalize("1917")).toMatchObject({ coreTitle: "1917", releaseYear: null });
    expect(normalizer.normalize("Room 237").coreTitle).toBe("Room 237");
  });

  it("drops series labels and event suffixes", () => {
    expect(normalizer.normalize("Eraserhead | Late Night").coreTitle).toBe("Eraserhead");
    expect(normalizer.normalize("VIFF Presents | Perfect Days").coreTitle).toBe("Perfect Days");
    expect(normalizer.normalize("Anora + Q&A with director")).toMatchObject({ coreTitle: "Anora", tags: ["Q&A"] });
    expect(normalizer.normalize("Nosferatu (1922) with live score")).toMatchObject({ coreTitle: "Nosferatu", releaseYear: 1922, tags: ["live"] });
    expect(normalizer.normalize("Chungking Express [4K]").coreTitle).toBe("Chungking Express");
    expect(normalizer.normalize("The Rio Presents: Tampopo").coreTitle).toBe("Tampopo");
    expect(normalizer.normalize("The Park Presents: Lawrence of Arabia (70mm)")).toMatchObject({ coreTitle: "Lawrence of Arabia", tags: ["70mm"] });
    expect(normalizer.normalize("Studio Ghibli Fest: Spirited Away").coreTitle).toBe("Spirited Away");
    expect(normalizer.normalize("Perfect Days — Vancouver Premiere").coreTitle).toBe("Perfect Days");
    expect(normalizer.normalize("Rocky Horror Picture Show (Sing-Along + Shadow Cast)")).toMatchObject({ coreTitle: "Rocky Horror Picture Show", tags: ["sing-along"] });
  });

  it("keeps titles that merely end in a series-like word", () => {
    expect(normalizer.normalize("The Breakfast Club: 35mm")).toMatchObject({ coreTitle: "The Breakfast Club", tags: ["35mm"] });
    expect(normalizer.normalize("The Breakfast Club: 40th Anniversary").coreTitle).toBe("The Breakfast Club");
    expect(normalizer.normalize("Fight Club: Director's Cut").coreTitle).toBe("Fight Club");
    expect(normalizer.normalize("Film Series: Tokyo Story").coreTitle).toBe("Tokyo Story");
  });

  it("treats concert films as films", () => {
    expect(normalizer.normalize("Stop Making Sense (Concert Film)")).toMatchObject({ coreTitle: "Stop Making Sense", contentKind: "film" });
    expect(normalizer.normalize("Summer of Soul (Documentary)").coreTitle).toBe("Summer of Soul");
    expect(normalizer.normalize("Live in Concert: The Beaches").contentKind).toBe("non_film");
  });

  it("leaves ordinary titles untouched", () => {
    for (const title of ["Paris, Texas", "Dune: Part Two", "Léon: The Professional", "Uncut Gems", "Extended Family", "The Party", "Festival Express"]) {
      expect(normalizer.normalize(title)).toMatchObject({ coreTitle: title, contentKind: "film", confidence: 0.96 });
    }
  });

  it("does not send non-film events to movie matching", () => {
    expect(normalizer.normalize("Friday Night Live Comedy Night").contentKind).toBe("non_film");
    expect(normalizer.normalize("Halloween Party with DJ").contentKind).toBe("non_film");
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
  it("refuses weak matches", () => {
    expect(confidentMatch(rankCandidates(input, [movie(1, "Making Sense of It All", "1999")]))).toBeNull();
    expect(confidentMatch([])).toBeNull();
  });
});
