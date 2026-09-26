import { describe, expect, it } from "vitest";
import { titleAfterSeriesLabel } from "../src/normalization/normalizer.js";
import { confidentMatch, explainRefusal, rankCandidates, titleSimilarity } from "../src/normalization/tmdb.js";
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

  it("keeps format and event labels as tags", () => {
    expect(normalizer.normalize("In the Mood for Love (2000) – 4K Restoration").tags).toEqual(["4K", "restoration"]);
    expect(normalizer.normalize("Tampopo with special guests")).toMatchObject({ coreTitle: "Tampopo", tags: ["guests"] });
    expect(normalizer.normalize("Paris, Texas + intro by the programmer")).toMatchObject({ coreTitle: "Paris, Texas", tags: ["guests"] });
    expect(normalizer.normalize("The Guest").tags).toEqual([]);
  });

  it("drops French language-version markers", () => {
    expect(normalizer.normalize("Anatomie d'une chute (v.o.s.t.a.)").coreTitle).toBe("Anatomie d'une chute");
    expect(normalizer.normalize("Perfect Days VOSTF").coreTitle).toBe("Perfect Days");
    expect(normalizer.normalize("Dune : deuxième partie (V.F.)").coreTitle).toBe("Dune : deuxième partie");
    expect(normalizer.normalize("Les Misérables - version originale sous-titrée en anglais").coreTitle).toBe("Les Misérables");
    expect(normalizer.normalize("Volcano").coreTitle).toBe("Volcano");
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
    expect(normalizer.normalize("Akira (4K Re-Release)")).toMatchObject({ coreTitle: "Akira", tags: ["4K", "re-release"] });
    expect(normalizer.normalize("Suspiria (Reissue)").coreTitle).toBe("Suspiria");
    expect(normalizer.normalize("The Rio Presents: Tampopo").coreTitle).toBe("Tampopo");
    expect(normalizer.normalize("The Park Presents: Lawrence of Arabia (70mm)")).toMatchObject({ coreTitle: "Lawrence of Arabia", tags: ["70mm"] });
    expect(normalizer.normalize("Studio Ghibli Fest: Spirited Away").coreTitle).toBe("Spirited Away");
    expect(normalizer.normalize("Perfect Days — Vancouver Premiere").coreTitle).toBe("Perfect Days");
    expect(normalizer.normalize("Rocky Horror Picture Show (Sing-Along + Shadow Cast)")).toMatchObject({ coreTitle: "Rocky Horror Picture Show", tags: ["sing-along"] });
  });

  it("drops a mixed-case series name before a title printed in capitals", () => {
    expect(normalizer.normalize("Destination Love: COMING TO AMERICA (1988) - New Restoration")).toMatchObject({ coreTitle: "COMING TO AMERICA", releaseYear: 1988 });
    expect(normalizer.normalize("Christmas Classics: ERNEST SAVES CHRISTMAS (1988) – Presented on 35mm!")).toMatchObject({ coreTitle: "ERNEST SAVES CHRISTMAS", releaseYear: 1988, tags: ["35mm"] });
    expect(normalizer.normalize("Revue Event: HOW WE ENDED US - North American Theatrical Premiere with Cast & Crew In Attendance!").coreTitle).toBe("HOW WE ENDED US");
    // Mixed case on both sides is left alone here; the pipeline retries after the label.
    expect(normalizer.normalize("Klassic Kidz: ParaNorman").coreTitle).toBe("Klassic Kidz: ParaNorman");
    expect(titleAfterSeriesLabel("Klassic Kidz: ParaNorman")).toBe("ParaNorman");
    expect(titleAfterSeriesLabel("Scream Queens: Us")).toBe("Us");
    expect(titleAfterSeriesLabel("Mission: Impossible")).toBe("Impossible");
    expect(titleAfterSeriesLabel("A very long series label with many words in it: Film")).toBeNull();
    expect(titleAfterSeriesLabel("Tony")).toBeNull();
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
    expect(normalizer.normalize("Private Event").contentKind).toBe("non_film");
  });
});

describe("listings seen on the venues' sites", () => {
  const normalizer = new DeterministicTitleNormalizer(() => new Date("2026-09-25T00:00:00Z"));
  const core = (title: string) => normalizer.normalize(title).coreTitle;

  it("drops presentation labels the venue tacks onto the end", () => {
    expect(core("The Devils: 4K Restoration!")).toBe("The Devils");
    expect(core("Thanksgiving Weekend: THE BIG CHILL (4K Restoration!)")).toBe("THE BIG CHILL");
    expect(core("Revue Event: JIGOKU (1960) - Toronto Theatrical Premiere of New 4K Restoration!")).toBe("JIGOKU");
    expect(core("35 on 35: SILENCE OF THE LAMBS (1991) - Presented on 35mm!")).toBe("SILENCE OF THE LAMBS");
    expect(core("Silent Revue: FAUST - 100th Anniversary Screening!")).toBe("FAUST");
    expect(core("Do You Like Pain? Retrospective: NIGHTBREED: The Director's Cut")).toBe("NIGHTBREED");
    expect(normalizer.normalize("Akira (2026 Restoration)")).toMatchObject({ coreTitle: "Akira", releaseYear: null, tags: ["restoration"] });
  });

  it("drops brackets and suffixes about the event rather than the film", () => {
    expect(normalizer.normalize("Los Ríos (Filmmakers in Attendance for Q&A)")).toMatchObject({ coreTitle: "Los Ríos", tags: ["Q&A", "guests"] });
    expect(core("Cast Aside the Clouds (Filmmakers in Attendance for Q&A)")).toBe("Cast Aside the Clouds");
    expect(core("Revue Event: LUNAR SWAY - Select Cast & Crew In Attendance!")).toBe("LUNAR SWAY");
    expect(core("Ginger Snaps Screening with Q&A from Katherine Isabelle")).toBe("Ginger Snaps");
    expect(normalizer.normalize("Dumpster Raccoon: GREASE SINGALONG AND SHADOWCAST!")).toMatchObject({ coreTitle: "GREASE", tags: ["sing-along"] });
    expect(core("Stompbox: THE SATURDAY MORNING ALL-YOU-CAN-EAT CEREAL CARTOON PARTY (Halloween Edition!)")).toBe("THE SATURDAY MORNING ALL-YOU-CAN-EAT CEREAL CARTOON PARTY");
    expect(normalizer.normalize("Revue Event: SORCERESS (1982) - With A Live Performance by THUNDER GLOVE!")).toMatchObject({ coreTitle: "SORCERESS", releaseYear: 1982, contentKind: "film", tags: ["live"] });
  });

  it("drops festival tags and French labels", () => {
    expect(core("Coward: VIFF 2026")).toBe("Coward");
    expect(core("Death Has No Master (La Muerte no Tiene Dueño): VIFF 2026")).toBe("Death Has No Master");
    expect(core("Castration Movie Chapter iii. Junior Ghosts (OFF-VIFF 2026, West Coast Premiere)")).toBe("Castration Movie Chapter iii. Junior Ghosts");
    expect(core("The Color of Pomegranates – Coups de coeur de l’équipe")).toBe("The Color of Pomegranates");
    expect(core("The Good, The Bad and The Ugly: 60e anniversaire")).toBe("The Good, The Bad and The Ugly");
  });

  it("reads every spelling of the language version and keeps it as a tag", () => {
    expect(normalizer.normalize("A Land Within (VOSTF-A)")).toMatchObject({ coreTitle: "A Land Within", tags: ["subtitled"] });
    expect(core("Les perdants (VO-SME)")).toBe("Les perdants");
    expect(core("Un renversement (VOF)")).toBe("Un renversement");
    expect(normalizer.normalize("Kiki's Delivery Service (SUB) (1989)")).toMatchObject({ coreTitle: "Kiki's Delivery Service", releaseYear: 1989, tags: ["subtitled"] });
    expect(normalizer.normalize("Kiki's Delivery Service (DUB) (1989)")).toMatchObject({ coreTitle: "Kiki's Delivery Service", tags: ["dubbed"] });
    expect(core("Ghost in the Shell: 30th Anniversary (SUB) (1995)")).toBe("Ghost in the Shell");
  });

  it("keeps other names the listing gives the film", () => {
    expect(normalizer.normalize("Agridulce (Bittersweet)")).toMatchObject({ coreTitle: "Agridulce", alternateTitles: ["Bittersweet"] });
    expect(normalizer.normalize("A BIT OF LIGHT (KAMI NOUR)")).toMatchObject({ coreTitle: "A BIT OF LIGHT", alternateTitles: ["KAMI NOUR"] });
    expect(normalizer.normalize("KEN RUSSELL’S THE DEVILS")).toMatchObject({ coreTitle: "KEN RUSSELL’S THE DEVILS", alternateTitles: ["THE DEVILS"] });
    expect(normalizer.normalize("Warren Miller’s DAYS OFF").alternateTitles).toEqual(["DAYS OFF"]);
    expect(normalizer.normalize("Schindler's List").alternateTitles).toBeUndefined();
    expect(normalizer.normalize("Mike Flanagan's 'Carrie' (Episodes 1 & 2)").coreTitle).toBe("Mike Flanagan's 'Carrie' (Episodes 1 & 2)");
  });

  it("takes the first film of a double bill", () => {
    expect(normalizer.normalize("Drunken Cinema: SCREAM (1996) + SCREAM 7 DOUBLE FEATURE!")).toMatchObject({ coreTitle: "SCREAM", releaseYear: 1996, tags: ["double bill"] });
    expect(core("Do You Like Pain? Retrospective Double Feature : HELLRAISER (1987) - Presented on 35mm + HELLBOUND: HELLRAISER II - Presented on DCP!")).toBe("HELLRAISER");
    expect(core("Romeo + Juliet")).toBe("Romeo + Juliet");
  });

  it("drops part numbering and offers the series name", () => {
    expect(normalizer.normalize("LA BATAILLE DE GAULLE: LIBERTÉ (PARTIE 2)")).toMatchObject({ coreTitle: "LA BATAILLE DE GAULLE: LIBERTÉ", alternateTitles: ["LA BATAILLE DE GAULLE"] });
    expect(core("Kill Bill: Vol. 1")).toBe("Kill Bill: Vol. 1");
    expect(core("Nymphomaniac (Part II)")).toBe("Nymphomaniac");
  });

  it("keeps typography TMDB uses", () => {
    expect(core("8½")).toBe("8½");
    expect(core("Doppelgängers³")).toBe("Doppelgängers³");
  });

  it("tells films with live music from gigs, and festivals from films", () => {
    expect(normalizer.normalize("Faust w/ Live Music by Invincible Czars")).toMatchObject({ coreTitle: "Faust", contentKind: "film", tags: ["live"] });
    expect(normalizer.normalize("Rental Event: HAYDEN Live at the Revue Cinema").contentKind).toBe("non_film");
    expect(normalizer.normalize("CLOSED FOR PRIVATE RENTAL").contentKind).toBe("non_film");
    expect(normalizer.normalize("The Rio Theatre Burlesque & Variety Show - Halloween Edition").contentKind).toBe("non_film");
    expect(normalizer.normalize("Revue Event: REEL FEAR - Lecture by Alex West").contentKind).toBe("non_film");
    expect(normalizer.normalize("EKRAN Toronto Polish Film Festival").contentKind).toBe("unknown");
    expect(normalizer.normalize("FESTIVAL INTERNATIONAL DU FILM BLACK DE MONTRÉAL").contentKind).toBe("unknown");
    expect(normalizer.normalize("Short Forum 2: Anthropomaxx").contentKind).toBe("unknown");
    expect(normalizer.normalize("MODES 2").contentKind).toBe("unknown");
    expect(normalizer.normalize("The King of Comedy").contentKind).toBe("film");
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

  it("lets a well-known film beat an obscure namesake, but not a remake with its own following", () => {
    const akira: NormalizedTitle = { ...input, coreTitle: "Akira", releaseYear: null, tags: [] };
    expect(confidentMatch(rankCandidates(akira, [movie(1, "Akira", "1988", 60), movie(2, "Akira", "2016", 4)]))?.movie.id).toBe(1);
    const recall: NormalizedTitle = { ...input, coreTitle: "Total Recall", releaseYear: null, tags: [] };
    expect(confidentMatch(rankCandidates(recall, [movie(1, "Total Recall", "1990", 40), movie(2, "Total Recall", "2012", 30)]))).toBeNull();
  });

  it("scores a partial-title candidate by how much of it the listing covers", () => {
    expect(titleSimilarity("Fjord", "Critical Role Live: Jester and Fjord's Wedding")).toBeLessThan(0.5);
    expect(titleSimilarity("The Silence of the Lambs", "The Making of 'The Silence of the Lambs'")).toBeLessThan(0.75);
    expect(titleSimilarity("Uprising", "The Uprising")).toBeGreaterThanOrEqual(0.95);
    expect(titleSimilarity("Barry Lindon", "Barry Lyndon")).toBeGreaterThan(0.85);
    expect(titleSimilarity("My Brother’s Wedding", "My Brother's Wedding")).toBe(1);
  });

  it("is not put off by a candidate that merely contains the title, has no date, or is itself too weak", () => {
    const lambs: NormalizedTitle = { ...input, coreTitle: "The Silence of the Lambs", releaseYear: 1991, tags: [] };
    expect(confidentMatch(rankCandidates(lambs, [movie(1, "The Silence of the Lambs", "1991", 80), movie(2, "The Making of 'The Silence of the Lambs'", "1991", 2)]))?.movie.id).toBe(1);
    const saut: NormalizedTitle = { ...input, coreTitle: "Le grand saut", releaseYear: null, tags: [] };
    const { release_date: _dropped, ...undated } = movie(1, "Le grand saut", "2020", 3);
    expect(confidentMatch(rankCandidates(saut, [undated, movie(2, "Le Grand Saut", "2020", 3)]))?.movie.id).toBe(2);
    const cinema: NormalizedTitle = { ...input, coreTitle: "Once Upon a Time in a Cinema", releaseYear: null, tags: [] };
    expect(confidentMatch(rankCandidates(cinema, [movie(1, "Once Upon a Time in a Cinema", "2026", 2), movie(2, "Once upon a time in cinema !!", "2018", 1)]))?.movie.id).toBe(1);
  });

  it("forgives a year a little off, as festival and local release years are", () => {
    const evilDead: NormalizedTitle = { ...input, coreTitle: "The Evil Dead", releaseYear: 1981, tags: [] };
    expect(confidentMatch(rankCandidates(evilDead, [movie(1, "The Evil Dead", "1983", 30), movie(2, "Evil Dead", "2013", 40)]))?.movie.id).toBe(1);
    const suicides: NormalizedTitle = { ...input, coreTitle: "The Virgin Suicides", releaseYear: 1999, tags: [] };
    expect(confidentMatch(rankCandidates(suicides, [movie(1, "The Virgin Suicides", "2000", 20)]))?.movie.id).toBe(1);
  });

  it("compares alternate and localized titles too", () => {
    const devils: NormalizedTitle = { ...input, coreTitle: "KEN RUSSELL’S THE DEVILS", releaseYear: null, tags: [], alternateTitles: ["THE DEVILS"] };
    expect(confidentMatch(rankCandidates(devils, [movie(1, "The Devils", "1971", 20)]))?.movie.id).toBe(1);
    const vincent: NormalizedTitle = { ...input, coreTitle: "VINCENT ET LA PROPHÉTIE DES MERS", releaseYear: null, tags: [] };
    const whale = { ...movie(1, "The Last Whale Singer", "2026", 5), localizedTitles: ["Vincent et la prophétie des mers"] };
    expect(confidentMatch(rankCandidates(vincent, [whale]))?.movie.id).toBe(1);
  });

  it("prefers the current release of a same-title pair only where the venue asks", () => {
    const fatherland: NormalizedTitle = { ...input, coreTitle: "Fatherland", releaseYear: null, tags: [] };
    const now = new Date("2026-09-26T00:00:00Z");
    const pair = [movie(1, "Fatherland", "2026", 4), movie(2, "Fatherland", "1994", 5)];
    expect(confidentMatch(rankCandidates(fatherland, pair))).toBeNull();
    expect(confidentMatch(rankCandidates(fatherland, pair), { preferRecent: true, now })?.movie.id).toBe(1);
    const both = [movie(1, "Fatherland", "2026", 4), movie(2, "Fatherland", "2026", 5)];
    expect(confidentMatch(rankCandidates(fatherland, both), { preferRecent: true, now })).toBeNull();
    const neither = [movie(1, "Day of Wrath", "1943", 9), movie(2, "Day of Wrath", "2006", 8)];
    expect(confidentMatch(rankCandidates({ ...fatherland, coreTitle: "Day of Wrath" }, neither), { preferRecent: true, now })).toBeNull();
  });

  it("explains a refusal", () => {
    const recall: NormalizedTitle = { ...input, coreTitle: "Total Recall", releaseYear: null, tags: [] };
    expect(explainRefusal(rankCandidates(recall, [movie(1, "Total Recall", "1990", 40), movie(2, "Total Recall", "2012", 30)]))).toMatch(/^refused: best "Total Recall" \(1990\) 0\.\d{3} and runner-up "Total Recall" \(2012\) 0\.\d{3} are within 0\.08$/);
    expect(explainRefusal(rankCandidates(input, [movie(1, "Making Sense of It All", "1999")]))).toMatch(/^refused: best .* is below 0\.8$/);
    expect(explainRefusal([])).toBe("refused: TMDB returned no candidates");
  });
});
