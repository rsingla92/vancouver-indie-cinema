import { fuzzy } from "fast-fuzzy";
import type { NormalizedTitle, RankedCandidate, TmdbMovie } from "./contracts.js";
import { canonicalTitle as canonical } from "./text.js";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_TIMEOUT_MS = 10_000;

/** Minimum blended score for an automatic link. */
export const MATCH_THRESHOLD = 0.8;
/** Minimum lead over the runner-up; closer than this is treated as ambiguous. */
export const AMBIGUITY_MARGIN = 0.08;
/** A runner-up with the same title but this many times less popular is a namesake, not an alternative. */
export const NAMESAKE_POPULARITY_RATIO = 5;

const LEADING_ARTICLE = /^(?:the|a|an|le|la|les|l|un|une|el|il|lo|los|las|der|die|das) /;

export function titleSimilarity(a: string, b: string): number {
  const x = canonical(a);
  const y = canonical(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.replace(LEADING_ARTICLE, "") === y.replace(LEADING_ARTICLE, "")) return 0.97;
  // Sellers scores the best-matching substring, so "Fjord" would score 1 against
  // "Jester and Fjord's Wedding"; weight it by how much of the longer title is covered.
  const coverage = Math.min(x.length, y.length) / Math.max(x.length, y.length);
  return Math.max(fuzzy(x, y, { useSellers: false }), fuzzy(x, y, { useSellers: true }) * coverage);
}

/** Listings print the year they know, which is often a festival or local release a year or two off TMDB's. */
function yearAgreement(listed: number | null, movieYear: number | null): number {
  if (listed === null) return movieYear ? 0.6 : 0.3;
  if (movieYear === null) return 0.1;
  const gap = Math.abs(movieYear - listed);
  return gap === 0 ? 1 : gap === 1 ? 0.75 : gap === 2 ? 0.55 : 0.1;
}

export function rankCandidates(input: NormalizedTitle, movies: TmdbMovie[]): RankedCandidate[] {
  const names = [input.coreTitle, ...(input.alternateTitles ?? [])];
  return movies.map((movie) => {
    const titles = [movie.title, movie.original_title, ...(movie.localizedTitles ?? [])];
    const similarity = Math.max(...names.flatMap((name) => titles.map((title) => titleSimilarity(name, title))));
    const movieYear = movie.release_date ? Number(movie.release_date.slice(0, 4)) : null;
    const yearScore = yearAgreement(input.releaseYear, movieYear);
    const popularityScore = Math.min(1, Math.log10(movie.popularity + 1) / 3);
    const score = Number((similarity * 0.72 + yearScore * 0.23 + popularityScore * 0.05).toFixed(3));
    return { movie, score, similarity, reason: `title=${similarity.toFixed(2)}, year=${yearScore.toFixed(2)}, popularity=${popularityScore.toFixed(2)}` };
  }).sort((a, b) => b.score - a.score);
}

/** A title that is exact, or exact but for a leading article. */
const EXACT = 0.97;

/**
 * The best-scored alternative that could itself be the film: it clears the threshold,
 * has a release date, and, when the leader has the exact title, so does it. The venue
 * printed the title it printed; a near miss is not what they meant.
 */
function rival(ranked: RankedCandidate[]): RankedCandidate | undefined {
  const [first] = ranked;
  return ranked.slice(1).find((candidate) =>
    candidate.score >= MATCH_THRESHOLD && candidate.movie.release_date && !(first!.similarity >= EXACT && candidate.similarity < EXACT));
}

export interface MatchOptions {
  /** A first-run house or a festival: of two same-title films, the current release is the one showing. */
  preferRecent?: boolean;
  now?: Date;
}

/** Released in the last eighteen months, or not yet. */
function isRecent(movie: TmdbMovie, now: Date): boolean {
  if (!movie.release_date) return false;
  return Date.parse(movie.release_date) >= now.getTime() - 548 * 86_400_000;
}

export function confidentMatch(ranked: RankedCandidate[], options: MatchOptions = {}): RankedCandidate | null {
  const [first] = ranked;
  if (!first || first.score < MATCH_THRESHOLD) return null;
  const second = rival(ranked);
  if (!second || first.score - second.score >= AMBIGUITY_MARGIN || isNamesake(first, second)) return first;
  if (options.preferRecent) {
    const now = options.now ?? new Date();
    const recent = [first, second].filter((candidate) => isRecent(candidate.movie, now));
    if (recent.length === 1) return recent[0]!;
  }
  return null;
}

/** Why `confidentMatch` returned null, kept on the raw item for the review queue. */
export function explainRefusal(ranked: RankedCandidate[]): string {
  const [first] = ranked;
  const second = rival(ranked);
  const describe = (candidate: RankedCandidate) =>
    `"${candidate.movie.title}" (${candidate.movie.release_date?.slice(0, 4) || "no date"}) ${candidate.score.toFixed(3)}`;
  if (!first) return "refused: TMDB returned no candidates";
  if (first.score < MATCH_THRESHOLD) return `refused: best ${describe(first)} is below ${MATCH_THRESHOLD}`;
  if (second) return `refused: best ${describe(first)} and runner-up ${describe(second)} are within ${AMBIGUITY_MARGIN}`;
  return "refused";
}

/**
 * Same-title films differ only in popularity when the listing gives no year. A
 * remake with a following of its own stays ambiguous; an obscure namesake does not.
 */
function isNamesake(leader: RankedCandidate, runnerUp: RankedCandidate): boolean {
  return leader.movie.popularity >= NAMESAKE_POPULARITY_RATIO * Math.max(runnerUp.movie.popularity, 1);
}

export class TmdbClient {
  constructor(private readonly token = process.env.TMDB_API_TOKEN) {}

  /**
   * Search in each language and merge by film, so a Montreal listing's French title
   * can be compared with TMDB's French title. When the title finds nothing, the first
   * alternate name (a bracketed original title) is tried.
   */
  async search(input: NormalizedTitle, languages: readonly string[] = ["en-CA"]): Promise<TmdbMovie[]> {
    const byId = new Map<number, TmdbMovie>();
    for (const language of languages) {
      for (const movie of await this.query(input.coreTitle, input.releaseYear, language)) {
        const known = byId.get(movie.id);
        if (!known) byId.set(movie.id, movie);
        else if (movie.title !== known.title) known.localizedTitles = [...(known.localizedTitles ?? []), movie.title];
      }
    }
    const alternate = input.alternateTitles?.[0];
    if (byId.size === 0 && alternate) return this.query(alternate, input.releaseYear, languages[0] ?? "en-CA");
    return [...byId.values()];
  }

  /** One film by TMDB id, for pinned titles. */
  async movie(id: number): Promise<TmdbMovie> {
    if (!this.token) throw new Error("TMDB_API_TOKEN is required");
    const response = await fetch(`${TMDB_BASE_URL}/movie/${id}?language=en-CA`, {
      headers: { Authorization: `Bearer ${this.token}`, accept: "application/json" },
      signal: AbortSignal.timeout(TMDB_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`TMDB movie ${id} failed (${response.status})`);
    const payload = await response.json() as Omit<TmdbMovie, "genre_ids"> & { genres?: { id: number }[] };
    const { genres, ...movie } = payload;
    return { ...movie, genre_ids: (genres ?? []).map((genre) => genre.id) };
  }

  private async query(title: string, year: number | null, language: string): Promise<TmdbMovie[]> {
    if (!this.token) throw new Error("TMDB_API_TOKEN is required");
    const params = new URLSearchParams({ query: title, include_adult: "false", language });
    if (year) params.set("year", String(year));
    const response = await fetch(`${TMDB_BASE_URL}/search/movie?${params}`, {
      headers: { Authorization: `Bearer ${this.token}`, accept: "application/json" },
      signal: AbortSignal.timeout(TMDB_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`TMDB search failed (${response.status})`);
    const payload = await response.json() as { results?: TmdbMovie[] };
    return payload.results ?? [];
  }
}
