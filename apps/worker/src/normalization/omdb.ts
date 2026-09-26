import type { NormalizedTitle } from "./contracts.js";
import { canonicalTitle as canonical } from "./text.js";

const OMDB_BASE_URL = "https://www.omdbapi.com/";
const OMDB_TIMEOUT_MS = 10_000;
/** OMDb's free tier allows a thousand requests a day; a title's answer is kept this long. */
export const OMDB_CACHE_TTL_MS = 7 * 86_400_000;

/** What a second database can add to a screening TMDB does not know. */
export interface OmdbFilm {
  imdbId: string;
  title: string;
  year: number | null;
  posterUrl?: string;
  plot?: string;
}

/** A small store for lookup answers, so a rerun costs no requests. */
export interface LookupCache {
  get(provider: string, key: string, maxAgeMs: number): Promise<unknown | undefined>;
  set(provider: string, key: string, value: unknown): Promise<void>;
}

interface OmdbTitle { Title: string; Year: string; imdbID: string; Type: string; Poster: string; Plot?: string; Response?: string }
interface OmdbSearch { Search?: OmdbTitle[]; Response: string }

const usable = (value: string | undefined): string | undefined => (value && value !== "N/A" ? value : undefined);
const yearOf = (value: string): number | null => (/^\d{4}/.test(value) ? Number(value.slice(0, 4)) : null);

function toFilm(entry: OmdbTitle): OmdbFilm {
  const poster = usable(entry.Poster);
  const plot = usable(entry.Plot);
  return { imdbId: entry.imdbID, title: entry.Title, year: yearOf(entry.Year), ...(poster ? { posterUrl: poster } : {}), ...(plot ? { plot } : {}) };
}

/**
 * IMDb-derived data via OMDb, consulted only when TMDB has no candidate. Festival
 * films tend to reach IMDb first. Matching is stricter than TMDB's, since there is
 * no scoring: the title must be exact, and the year must agree when the venue gave one.
 */
export class OmdbClient {
  /** Set once OMDb rejects the key or the day's allowance, so the run stops asking. */
  private stopped: string | null = null;

  constructor(private readonly apiKey = process.env.OMDB_API_KEY, private readonly cache?: LookupCache) {}

  get enabled(): boolean {
    return Boolean(this.apiKey) && this.stopped === null;
  }

  async lookup(input: NormalizedTitle): Promise<OmdbFilm | null> {
    if (!this.apiKey) return null;
    const names = [input.coreTitle, ...(input.alternateTitles ?? [])].map(canonical);
    const key = `${names[0]}|${input.releaseYear ?? ""}`;
    const cached = await this.cache?.get("omdb", key, OMDB_CACHE_TTL_MS);
    if (cached !== undefined) return cached as OmdbFilm | null;

    const film = await this.find(input, names);
    await this.cache?.set("omdb", key, film);
    return film;
  }

  private async find(input: NormalizedTitle, names: string[]): Promise<OmdbFilm | null> {
    const exact = (entry: OmdbTitle) => entry.Type === "movie" && names.includes(canonical(entry.Title));
    if (input.releaseYear) {
      const entry = await this.request<OmdbTitle>({ t: input.coreTitle, y: String(input.releaseYear), plot: "short" });
      return entry.Response === "True" && exact(entry) ? toFilm(entry) : null;
    }
    const search = await this.request<OmdbSearch>({ s: input.coreTitle, type: "movie" });
    const matches = (search.Search ?? []).filter(exact);
    if (matches.length !== 1) return null;
    const entry = await this.request<OmdbTitle>({ i: matches[0]!.imdbID, plot: "short" });
    return entry.Response === "True" ? toFilm(entry) : null;
  }

  private async request<T>(params: Record<string, string>): Promise<T> {
    if (this.stopped) throw new Error(this.stopped);
    const query = new URLSearchParams({ ...params, apikey: this.apiKey! });
    const response = await fetch(`${OMDB_BASE_URL}?${query}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(OMDB_TIMEOUT_MS) });
    if (!response.ok) {
      // 401 is both "invalid key" and "request limit reached": neither changes within a run.
      const reason = `OMDb request failed (${response.status}${await this.errorText(response)})`;
      if (response.status === 401) this.stopped = reason;
      throw new Error(reason);
    }
    return await response.json() as T;
  }

  private async errorText(response: Response): Promise<string> {
    try {
      const body = await response.json() as { Error?: string };
      return body.Error ? `: ${body.Error}` : "";
    } catch {
      return "";
    }
  }
}
