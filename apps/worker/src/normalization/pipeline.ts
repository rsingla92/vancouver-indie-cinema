import { createHash } from "node:crypto";
import type { ExtractedShowtime } from "../contracts.js";
import type { TitleNormalizer } from "./contracts.js";
import { DeterministicTitleNormalizer, NORMALIZATION_RULES_VERSION } from "./normalizer.js";
import { CinemaRepository, type MergeResult } from "./repository.js";
import { confidentMatch, explainRefusal, rankCandidates, TmdbClient } from "./tmdb.js";

/** Normalizations below this confidence are never auto-matched against TMDB. */
export const MIN_NORMALIZATION_CONFIDENCE = 0.7;

export interface PipelineDependencies {
  normalizer: TitleNormalizer;
  tmdb: Pick<TmdbClient, "search">;
  repository: Pick<CinemaRepository, "merge">;
  rulesVersion: string;
}

export interface ProcessContext {
  ingestionRunId?: string;
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
  const normalized = { ...fromTitle, releaseYear: fromTitle.releaseYear ?? item.releaseYear ?? null };
  const eligible = normalized.contentKind === "film" && normalized.confidence >= MIN_NORMALIZATION_CONFIDENCE;
  const ranked = eligible ? rankCandidates(normalized, await dependencies.tmdb.search(normalized)) : [];
  const candidate = eligible ? confidentMatch(ranked) : null;
  const refusal = candidate ? null : eligible ? explainRefusal(ranked) : `not searched: ${normalized.contentKind === "film" ? "low normalization confidence" : normalized.contentKind}`;

  return dependencies.repository.merge({
    item,
    normalized,
    candidate,
    ...(refusal ? { refusal } : {}),
    payloadHash: stablePayloadHash(item),
    rulesVersion: dependencies.rulesVersion,
    ...(context.ingestionRunId ? { ingestionRunId: context.ingestionRunId } : {}),
  });
}

export function createDefaultPipeline() {
  return {
    normalizer: new DeterministicTitleNormalizer(),
    tmdb: new TmdbClient(),
    repository: new CinemaRepository(),
    rulesVersion: NORMALIZATION_RULES_VERSION,
  };
}
