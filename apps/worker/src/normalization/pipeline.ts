import { createHash } from "node:crypto";
import type { ExtractedShowtime } from "../contracts.js";
import type { TitleNormalizer } from "./contracts.js";
import { DeterministicTitleNormalizer, NORMALIZATION_RULES_VERSION } from "./normalizer.js";
import { CinemaRepository } from "./repository.js";
import { confidentMatch, rankCandidates, TmdbClient } from "./tmdb.js";


export interface PipelineDependencies {
  normalizer: TitleNormalizer;
  tmdb: Pick<TmdbClient, "search">;
  repository: Pick<CinemaRepository, "merge">;
  rulesVersion: string;
}


export function stablePayloadHash(item: ExtractedShowtime): string {
  const ordered = JSON.stringify(item.sourcePayload, Object.keys(item.sourcePayload).sort());
  return createHash("sha256").update(ordered).digest("hex");
}


export async function processShowtime(item: ExtractedShowtime, dependencies: PipelineDependencies) {
  const normalized = dependencies.normalizer.normalize(item.rawTitle);
  const candidates = normalized.contentKind === "film" ? await dependencies.tmdb.search(normalized) : [];
  const candidate = normalized.confidence >= 0.7 ? confidentMatch(rankCandidates(normalized, candidates)) : null;
  return dependencies.repository.merge({ item, normalized, candidate, payloadHash: stablePayloadHash(item), rulesVersion: dependencies.rulesVersion });
}


export function createDefaultPipeline() {
  return { normalizer: new DeterministicTitleNormalizer(), tmdb: new TmdbClient(), repository: new CinemaRepository(), rulesVersion: NORMALIZATION_RULES_VERSION };
}
