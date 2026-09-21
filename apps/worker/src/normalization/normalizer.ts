import { filenameParse } from "@ctrl/video-filename-parser";
import type { NormalizedTitle, TitleNormalizer } from "./contracts.js";

export const NORMALIZATION_RULES_VERSION = "title-rules-v1";

const TAG_PATTERNS = [
  ["35mm", /\b35\s*mm\b/i], ["70mm", /\b70\s*mm\b/i], ["16mm", /\b16\s*mm\b/i],
  ["Q&A", /\bq\s*&\s*a\b|question(?:s)?\s+and\s+answer(?:s)?/i],
  ["restoration", /\b(?:4k\s+)?restor(?:ed|ation)\b|\bremaster(?:ed)?\b/i],
  ["sing-along", /\bsing[ -]?along\b/i], ["captioned", /\b(?:open\s+)?caption(?:ed|s)?\b|\boc\b/i],
  ["live", /\blive\s+(?:performance|score|music)\b/i],
] as const;

const NON_FILM_PATTERNS = [
  /\b(?:comedy|trivia|karaoke)\s+night\b/i,
  /\b(?:concert|party|workshop|lecture|panel discussion)\b/i,
  /\blive\s+(?:music|podcast|performance)\b/i,
];

const PREFIXES = [
  /^(?:special event|encore presentation|the rio presents|viff presents|the cinematheque presents)\s*[:\-–—]\s*/i,
  /^(?:double feature|late night|community screening)\s*[:\-–—]\s*/i,
];

function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export class DeterministicTitleNormalizer implements TitleNormalizer {
  normalize(rawTitle: string): NormalizedTitle {
    const tags = TAG_PATTERNS.filter(([, pattern]) => pattern.test(rawTitle)).map(([tag]) => tag);
    const contentKind = NON_FILM_PATTERNS.some((pattern) => pattern.test(rawTitle)) ? "non_film" : "film";
    let cleaned = rawTitle.normalize("NFKC").replace(/\s+/g, " ").trim();
    for (const prefix of PREFIXES) cleaned = cleaned.replace(prefix, "");
    for (const [, pattern] of TAG_PATTERNS) cleaned = cleaned.replace(pattern, " ");
    cleaned = cleaned.replace(/\s*[|•]\s*(?:tickets?|doors?|hosted by|presented by).*$/i, "")
      .replace(/\s*[-–—]\s*(?:tickets?|doors?)\s+.*$/i, "").replace(/\s+/g, " ")
      .replace(/\(\s*\)|\[\s*\]/g, " ").replace(/\s+/g, " ")
      .replace(/^[\s:|\-–—]+|[\s:|\-–—]+$/g, "").trim();

    const parsed = filenameParse(cleaned);
    const parsedTitle = parsed.title?.trim() || cleaned;
    const explicitYear = rawTitle.match(/(?:^|[^\d])((?:18|19|20|21)\d{2})(?:[^\d]|$)/)?.[1];
    const releaseYear = explicitYear ? Number(explicitYear) : parsed.year ? Number(parsed.year) : null;
    const removedText = rawTitle.replace(new RegExp(escapeRegExp(parsedTitle), "i"), "").trim();
    return {
      coreTitle: parsedTitle, releaseYear, contentKind, tags: [...new Set(tags)],
      confidence: contentKind === "non_film" ? 0.98 : parsedTitle.length >= 2 ? (removedText ? 0.9 : 0.96) : 0.45,
      note: removedText ? "Deterministic cleanup removed promotional or format text" : "Title used without promotional cleanup",
    };
  }
}
