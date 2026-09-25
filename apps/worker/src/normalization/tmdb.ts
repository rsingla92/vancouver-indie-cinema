import { fuzzy } from "fast-fuzzy";
import type { NormalizedTitle, RankedCandidate, TmdbMovie } from "./contracts.js";
import { canonicalTitle as canonical } from "./text.js";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_TIMEOUT_MS = 10_000;

/** Minimum blended score for an automatic link. */
export const MATCH_THRESHOLD = 0.82;
/** Minimum lead over the runner-up; closer than this is treated as ambiguous. */
export const AMBIGUITY_MARGIN = 0.08;
/** A runner-up with the same title but this many times less popular is a namesake, not an alternative. */
export const NAMESAKE_POPULARITY_RATIO = 5;

export function titleSimilarity(a: string, b: string): number {
  if (canonical(a) === canonical(b)) return 1;
  return fuzzy(canonical(a), canonical(b), { useSellers: true });
}

export function rankCandidates(input: NormalizedTitle, movies: TmdbMovie[]): RankedCandidate[] {
  return movies.map((movie) => {
    const similarity = Math.max(titleSimilarity(input.coreTitle, movie.title), titleSimilarity(input.coreTitle, movie.original_title));
    const movieYear = movie.release_date ? Number(movie.release_date.slice(0, 4)) : null;
    const yearScore = input.releaseYear === null ? 0.6 : movieYear === input.releaseYear ? 1 : movieYear && Math.abs(movieYear - input.releaseYear) === 1 ? 0.35 : 0;
    const popularityScore = Math.min(1, Math.log10(movie.popularity + 1) / 3);
    const score = Number((similarity * 0.72 + yearScore * 0.23 + popularityScore * 0.05).toFixed(3));
    return { movie, score, reason: `title=${similarity.toFixed(2)}, year=${yearScore.toFixed(2)}, popularity=${popularityScore.toFixed(2)}` };
  }).sort((a, b) => b.score - a.score);
}

export function confidentMatch(ranked: RankedCandidate[]): RankedCandidate | null {
  const [first, second] = ranked;
  if (!first || first.score < MATCH_THRESHOLD) return null;
  if (second && first.score - second.score < AMBIGUITY_MARGIN && !isNamesake(first, second)) return null;
  return first;
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

  async search(input: NormalizedTitle): Promise<TmdbMovie[]> {
    if (!this.token) throw new Error("TMDB_API_TOKEN is required");
    const params = new URLSearchParams({ query: input.coreTitle, include_adult: "false", language: "en-CA" });
    if (input.releaseYear) params.set("year", String(input.releaseYear));
    const response = await fetch(`${TMDB_BASE_URL}/search/movie?${params}`, {
      headers: { Authorization: `Bearer ${this.token}`, accept: "application/json" },
      signal: AbortSignal.timeout(TMDB_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`TMDB search failed (${response.status})`);
    const payload = await response.json() as { results?: TmdbMovie[] };
    return payload.results ?? [];
  }
}
