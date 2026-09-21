import type { NormalizedTitle, RankedCandidate, TmdbMovie } from "./contracts.js";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

function canonical(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

function bigrams(value: string): Set<string> {
  const compact = ` ${canonical(value)} `;
  return new Set(Array.from({ length: Math.max(0, compact.length - 1) }, (_, index) => compact.slice(index, index + 2)));
}

export function titleSimilarity(a: string, b: string): number {
  if (canonical(a) === canonical(b)) return 1;
  const left = bigrams(a);
  const right = bigrams(b);
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const pair of left) if (right.has(pair)) overlap += 1;
  return (2 * overlap) / (left.size + right.size);
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
  if (!first || first.score < 0.82) return null;
  if (second && first.score - second.score < 0.08) return null;
  return first;
}

export class TmdbClient {
  constructor(private readonly token = process.env.TMDB_API_TOKEN) {}

  async search(input: NormalizedTitle): Promise<TmdbMovie[]> {
    if (!this.token) throw new Error("TMDB_API_TOKEN is required");
    const params = new URLSearchParams({ query: input.coreTitle, include_adult: "false", language: "en-CA" });
    if (input.releaseYear) params.set("year", String(input.releaseYear));
    const response = await fetch(`${TMDB_BASE_URL}/search/movie?${params}`, {
      headers: { Authorization: `Bearer ${this.token}`, accept: "application/json" },
    });
    if (!response.ok) throw new Error(`TMDB search failed (${response.status})`);
    const payload = await response.json() as { results: TmdbMovie[] };
    return payload.results;
  }
}
