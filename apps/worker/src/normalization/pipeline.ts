import { createHash } from "node:crypto";
import type { ExtractedShowtime } from "../contracts.js";
import { OpenAITitleNormalizer, type TitleNormalizer } from "./openai.js";
import { CinemaRepository } from "./repository.js";
import { confidentMatch, rankCandidates, TmdbClient } from "./tmdb.js";

export interface PipelineDependencies {
  normalizer: TitleNormalizer;
  tmdb: Pick<TmdbClient, "search">;
  repository: Pick<CinemaRepository, "merge">;
  model: string;
}

export function stablePayloadHash(item: ExtractedShowtime): string {
  const ordered = JSON.stringify(item.sourcePayload, Object.keys(item.sourcePayload).sort());
  return createHash("sha256").update(ordered).digest("hex");
}

export async function processShowtime(item: ExtractedShowtime, dependencies: PipelineDependencies) {
  const normalized = await dependencies.normalizer.normalize(item.rawTitle);
  const candidates = normalized.contentKind === "film" ? await dependencies.tmdb.search(normalized) : [];
  const candidate = normalized.confidence >= 0.7 ? confidentMatch(rankCandidates(normalized, candidates)) : null;
  return dependencies.repository.merge({ item, normalized, candidate, payloadHash: stablePayloadHash(item), model: dependencies.model });
}

export function createDefaultPipeline() {
  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";
  return { normalizer: new OpenAITitleNormalizer({ model }), tmdb: new TmdbClient(), repository: new CinemaRepository(), model };
}
