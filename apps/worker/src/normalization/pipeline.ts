import { createHash } from "node:crypto";
import type { ExtractedShowtime } from "../contracts.js";
import type { TitleNormalizer } from "./contracts.js";
import { DeterministicTitleNormalizer, NORMALIZATION_RULES_VERSION, titleAfterSeriesLabel } from "./normalizer.js";
import { CinemaRepository, type MergeResult } from "./repository.js";
import { OmdbClient } from "./omdb.js";
import { canonicalTitle } from "./text.js";
import { confidentMatch, explainRefusal, MATCH_THRESHOLD, rankCandidates, TmdbClient } from "./tmdb.js";

/** Normalizations below this confidence are never auto-matched against TMDB. */
export const MIN_NORMALIZATION_CONFIDENCE = 0.7;

export interface PipelineDependencies {
  normalizer: TitleNormalizer;
  tmdb: Pick<TmdbClient, "search"> & Partial<Pick<TmdbClient, "movie">>;
  /** Second database, consulted only when TMDB has no candidate at all. */
  omdb?: Pick<OmdbClient, "enabled" | "lookup">;
  repository: Pick<CinemaRepository, "merge">;
  rulesVersion: string;
}

export interface ProcessContext {
  ingestionRunId?: string;
  /** TMDB languages to search in; Quebec venues add fr-CA so French titles compare against French titles. */
  languages?: readonly string[];
  /** The venue is a first-run house or a festival: prefer the current release of a same-title pair. */
  preferRecent?: boolean;
  /** Films pinned by title for this venue (title_overrides), keyed by canonical title. */
  overrides?: ReadonlyMap<string, number>;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * Hash of everything the extractor observed for a showtime, independent of key
 * order at any depth. A changed title, time, status or ticket link yields a new
 * hash and therefore a new raw_source_items revision.
 */
export function stablePayloadHash(item: ExtractedShowtime): string {
  const { venueSlug: _venueSlug, sourceUid: _sourceUid, ...observed } = item;
  return createHash("sha256").update(stableStringify(observed)).digest("hex");
}

export async function processShowtime(
  item: ExtractedShowtime,
  dependencies: PipelineDependencies,
  context: ProcessContext = {},
): Promise<MergeResult> {
  const fromTitle = dependencies.normalizer.normalize(item.rawTitle);
  // A year printed in the title wins; otherwise one the venue states elsewhere on the page.
  let normalized = { ...fromTitle, releaseYear: fromTitle.releaseYear ?? item.releaseYear ?? null };
  const eligible = normalized.contentKind === "film" && normalized.confidence >= MIN_NORMALIZATION_CONFIDENCE;
  const match = { preferRecent: context.preferRecent ?? false };

  // A pinned title needs no search: the film was chosen by hand.
  const pinnedId = context.overrides?.get(canonicalTitle(normalized.coreTitle)) ?? context.overrides?.get(canonicalTitle(item.rawTitle));
  if (pinnedId && dependencies.tmdb.movie) {
    const movie = await dependencies.tmdb.movie(pinnedId);
    return dependencies.repository.merge({
      item,
      normalized,
      candidate: { movie, score: 1, similarity: 1, reason: `pinned to TMDB ${pinnedId} by title_overrides` },
      payloadHash: stablePayloadHash(item),
      rulesVersion: dependencies.rulesVersion,
      ...(context.ingestionRunId ? { ingestionRunId: context.ingestionRunId } : {}),
    });
  }

  let ranked = eligible ? rankCandidates(normalized, await dependencies.tmdb.search(normalized, context.languages)) : [];
  let candidate = eligible ? confidentMatch(ranked, match) : null;

  // "Klassic Kidz: ParaNorman" finds nothing as a whole; the part after the series label may.
  const afterLabel = eligible && !candidate ? titleAfterSeriesLabel(normalized.coreTitle) : null;
  if (afterLabel) {
    const retried = { ...normalized, coreTitle: afterLabel, note: `${normalized.note}; series label dropped after the full title found no match` };
    const rankedAgain = rankCandidates(retried, await dependencies.tmdb.search(retried, context.languages));
    const found = confidentMatch(rankedAgain, match);
    if (found) {
      normalized = retried;
      ranked = rankedAgain;
      candidate = found;
    }
  }
  let refusal = candidate ? null : eligible ? explainRefusal(ranked) : `not searched: ${normalized.contentKind === "film" ? "low normalization confidence" : normalized.contentKind}`;

  // TMDB knows nothing that could be the film: ask OMDb for a poster and a plot to list it with.
  let details: { imageUrl?: string; synopsis?: string } | undefined;
  const nothingClose = ranked.length === 0 || ranked[0]!.score < MATCH_THRESHOLD;
  if (!candidate && eligible && nothingClose && dependencies.omdb?.enabled) {
    const film = await dependencies.omdb.lookup(normalized);
    if (film) {
      details = { ...(film.posterUrl ? { imageUrl: film.posterUrl } : {}), ...(film.plot ? { synopsis: film.plot } : {}) };
      refusal = `${refusal}; OMDb has "${film.title}" (${film.year ?? "no date"}, ${film.imdbId})`;
    } else {
      refusal = `${refusal}; OMDb has nothing`;
    }
  }

  return dependencies.repository.merge({
    item,
    normalized,
    candidate,
    ...(refusal ? { refusal } : {}),
    ...(details ? { details } : {}),
    payloadHash: stablePayloadHash(item),
    rulesVersion: dependencies.rulesVersion,
    ...(context.ingestionRunId ? { ingestionRunId: context.ingestionRunId } : {}),
  });
}

export function createDefaultPipeline() {
  const repository = new CinemaRepository();
  return {
    normalizer: new DeterministicTitleNormalizer(),
    tmdb: new TmdbClient(),
    omdb: new OmdbClient(process.env.OMDB_API_KEY, repository),
    repository,
    rulesVersion: NORMALIZATION_RULES_VERSION,
  };
}
