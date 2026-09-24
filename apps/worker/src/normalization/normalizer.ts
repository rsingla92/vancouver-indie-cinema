import { filenameParse } from "@ctrl/video-filename-parser";
import type { NormalizedTitle, TitleNormalizer } from "./contracts.js";
import { canonicalTitle } from "./text.js";

export const NORMALIZATION_RULES_VERSION = "title-rules-v2";

type Tag = NormalizedTitle["tags"][number];

const TAG_PATTERNS: ReadonlyArray<readonly [Tag, RegExp]> = [
  ["35mm", /\b35\s*mm\b/i],
  ["70mm", /\b70\s*mm\b/i],
  ["16mm", /\b16\s*mm\b/i],
  ["Q&A", /\bq\s*(?:&|\+|and)\s*a\b|\bquestions?\s+(?:and|&)\s+answers?\b/i],
  ["restoration", /\b(?:(?:new\s+)?[24]k\s+)?restor(?:ed|ation)\b|\bremaster(?:ed)?\b/i],
  ["sing-along", /\bsing[ -]?along\b/i],
  ["captioned", /\b(?:open\s+)?caption(?:ed|s)?\b|\boc\b/i],
  ["live", /\blive\s+(?:performance|score|music|soundtrack|accompaniment|narration)\b/i],
];

const NON_FILM_PATTERNS = [
  /\b(?:comedy|trivia|karaoke|quiz|bingo|open\s+mic|drag)\s+(?:night|show)\b/i,
  /\b(?:concert(?!\s+(?:film|doc|documentary|movie))|workshop|lecture|panel\s+discussion|book\s+launch|stand-?up\s+comedy)\b/i,
  /\b(?:dance|after|release|launch|costume|halloween|new\s+year'?s?(?:\s+eve)?|listening|album)\s+party\b/i,
  /\blive\s+(?:music|podcast|performance|comedy|taping|reading)\b/i,
];

// Venue-specific series and event labels that precede or accompany a title.
const PROMO_LABEL =
  "special (?:event|presentation|screening)|encore(?: presentation| screening)?|(?:the )?rio presents|(?:the )?park(?: theatre)? presents|viff presents|" +
  "(?:the )?cinematheque presents|hollywood theatre presents|double (?:feature|bill)|late (?:night|nite)|community screening|" +
  "members?['’]? (?:only )?screening|members? only|film club|cinema club|free screening|free|sneak preview|preview screening|" +
  "preview|opening night|closing night|staff picks?|new (?:[24]k )?restoration|[24]k restoration|[24]k|" +
  "(?:vancouver|canadian|west coast|north american|world) premiere|premiere|matinee|all ages|19\\+|sold out|" +
  "cult classics?|movie night|film night|film series|series|" +
  "\\d+(?:st|nd|rd|th)[- ]anniversary(?: (?:screening|edition|celebration|presentation))?|anniversary (?:screening|edition)";

const PREFIX_PATTERN = new RegExp(`^(?:${PROMO_LABEL})\\s*[:\\-–—|]\\s*`, "i");
// "Studio Ghibli Fest: Spirited Away", "Cinema Salon: Tokyo Story" — a short series name ending in a series-ish word.
// Words like "club" are deliberately absent: "Fight Club: 35mm" is a title, not a series.
const SERIES_PREFIX_PATTERN = /^[^:|]{0,60}?\b(?:fest|festival|series|salon|presents|showcase|spotlight|retrospective|marathon)\s*:\s*/i;
// "Perfect Days — Vancouver Premiere", "Moonlight (Free)"
const TRAILING_PROMO_PATTERN = new RegExp(`\\s*[-–—:|(\\[]\\s*(?:${PROMO_LABEL})\\s*[)\\]]?\\s*$`, "i");
// "(Sing-Along + Shadow Cast)" after the tag is removed leaves "( + Shadow Cast)": an add-on, not the title.
const CONNECTOR_BRACKET_PATTERN = /[(\[]\s*(?:\+|&|and\b|with\b|w\/)[^)\]]*[)\]]/gi;
const PROMO_SEGMENT_PATTERN = new RegExp(
  `^(?:${PROMO_LABEL}|.*\\bpresents\\b.*|.*\\bseries\\b.*|.*\\bfestival\\b.*|.*\\bshowcase\\b.*|tickets?\\b.*|doors?\\b.*|` +
  "hosted by\\b.*|presented by\\b.*|with\\b.*|featuring\\b.*|feat\\.?\\s.*|q\\s*&\\s*a\\b.*|(?:open )?captioned|sing-?along)$",
  "i",
);
const SEGMENT_SEPARATOR = /\s*[|•]\s*/;

const EVENT_SUFFIX = "tickets?|doors?|hosted by|presented by|with (?:director|filmmaker|guests?|special guests?|live|intro|q\\s*&\\s*a)|" +
  "in conversation|introduced by|intro(?:duction)? by|followed by|preceded by|plus\\s|q\\s*&\\s*a|q\\s+and\\s+a";
const SUFFIX_PATTERNS = [
  new RegExp(`\\s*\\+\\s*(?:${EVENT_SUFFIX}|with\\b|w/|discussion|intro(?:duction)?\\b|panel|talk|director|filmmaker|live\\b|pre-?show|post-?show|after-?party|reception|performance|dj\\b|guest).*$`, "i"),
  /\s+w\/\s+.*$/i,
  new RegExp(`\\s*[-–—:,]\\s*(?:${EVENT_SUFFIX}).*$`, "i"),
  new RegExp(`\\s*[(\\[]\\s*(?:${EVENT_SUFFIX})[^)\\]]*[)\\]]`, "i"),
];

// "(Concert Film)", "(Documentary)": a description of the film, not part of its title.
const DESCRIPTOR_BRACKET_PATTERN = /\s*[(\[]\s*(?:concert (?:film|documentary|movie)|documentary|short film|silent film)\s*[)\]]/gi;
const EDITION_PATTERN = /\s*[(\[]?\s*\b(?:[24]k(?:\s+(?:digital\s+)?(?:restoration|remaster|scan|dcp|print))?|remastered|restored|new\s+restoration|director'?s\s+cut|final\s+cut|extended\s+(?:cut|edition|version)|theatrical\s+(?:cut|version)|imax|dcp|digital\s+restoration|new\s+print|archival\s+print|\d{2}mm\s+print)\b\s*[)\]]?/gi;

const BRACKETED_YEAR = /[(\[]\s*((?:18|19|20)\d{2})\s*[)\]]/;
const TRAILING_YEAR = /[,\-–—:|]\s*((?:18|19|20)\d{2})\s*$/;

const EMPTY_BRACKETS = /\(\s*\)|\[\s*\]/g;
const EDGE_SEPARATORS = /^[\s:|\-–—+•,]+|[\s:|\-–—+•,]+$/g;
const DANGLING_CONNECTOR = /\s+(?:with|and|&|featuring|feat\.?|w\/)\s*$/i;

function tidy(value: string): string {
  return value.replace(EMPTY_BRACKETS, " ").replace(/\s+/g, " ").replace(EDGE_SEPARATORS, "").replace(DANGLING_CONNECTOR, "").trim();
}

/** True when a piece of text carries no title, only labels, tags or edition words. */
function isPromotionalSegment(segment: string): boolean {
  if (PROMO_SEGMENT_PATTERN.test(segment)) return true;
  let rest = segment.replace(EDITION_PATTERN, " ").replace(DESCRIPTOR_BRACKET_PATTERN, " ");
  for (const [, pattern] of TAG_PATTERNS) rest = rest.replace(pattern, " ");
  return tidy(rest) === "";
}

/** "Eraserhead | Late Night" → "Eraserhead"; "VIFF Presents | Perfect Days" → "Perfect Days". */
function chooseSegment(value: string): string {
  const segments = value.split(SEGMENT_SEPARATOR).map((segment) => segment.trim()).filter(Boolean);
  if (segments.length <= 1) return value;
  return segments.find((segment) => !isPromotionalSegment(segment)) ?? segments[0]!;
}

/** Only a year that the listing sets apart, e.g. "(1978)" or "– 1978", counts. "2001: A Space Odyssey" keeps its number. */
function extractExplicitYear(value: string, maxYear: number): { year: number | null; rest: string } {
  for (const pattern of [BRACKETED_YEAR, TRAILING_YEAR]) {
    const match = value.match(pattern);
    if (!match) continue;
    const year = Number(match[1]);
    if (year > maxYear) continue;
    return { year, rest: value.replace(match[0], " ") };
  }
  return { year: null, rest: value };
}

export class DeterministicTitleNormalizer implements TitleNormalizer {
  constructor(private readonly now: () => Date = () => new Date()) {}

  normalize(rawTitle: string): NormalizedTitle {
    const tags = TAG_PATTERNS.filter(([, pattern]) => pattern.test(rawTitle)).map(([tag]) => tag);
    const contentKind = NON_FILM_PATTERNS.some((pattern) => pattern.test(rawTitle)) ? "non_film" : "film";

    const { year: releaseYear, rest } = extractExplicitYear(
      rawTitle.normalize("NFKC").replace(/\s+/g, " ").trim(),
      this.now().getFullYear() + 1,
    );

    let cleaned = rest;
    for (let pass = 0; pass < 3; pass += 1) {
      if (PREFIX_PATTERN.test(cleaned)) { cleaned = cleaned.replace(PREFIX_PATTERN, ""); continue; }
      const series = cleaned.match(SERIES_PREFIX_PATTERN);
      if (!series) break;
      // Only drop a series prefix when a title is left behind; "Fight Club: 35mm" keeps "Fight Club".
      const remainder = cleaned.slice(series[0].length);
      if (isPromotionalSegment(remainder)) break;
      cleaned = remainder;
    }
    cleaned = chooseSegment(cleaned);
    for (const pattern of SUFFIX_PATTERNS) cleaned = cleaned.replace(pattern, "");
    for (let pass = 0; pass < 2 && TRAILING_PROMO_PATTERN.test(cleaned); pass += 1) cleaned = cleaned.replace(TRAILING_PROMO_PATTERN, "");
    for (const [, pattern] of TAG_PATTERNS) cleaned = cleaned.replace(pattern, " ");
    cleaned = tidy(cleaned.replace(EDITION_PATTERN, " ").replace(DESCRIPTOR_BRACKET_PATTERN, " ").replace(CONNECTOR_BRACKET_PATTERN, " "));

    // Radarr-style parsing is a final safety net for release-style suffixes. It is only
    // trusted when it merely trims the end of the title and did not mistake part of the
    // title (e.g. "Blade Runner 2049") for a release year.
    const parsed = filenameParse(cleaned);
    const parsedTitle = parsed.title?.trim() ?? "";
    const coreTitle = tidy(
      parsedTitle && !parsed.year && cleaned.toLowerCase().startsWith(parsedTitle.toLowerCase()) ? parsedTitle : cleaned,
    ) || rawTitle.trim();

    const changed = canonicalTitle(coreTitle) !== canonicalTitle(rawTitle);
    return {
      coreTitle,
      releaseYear,
      contentKind,
      tags: [...new Set(tags)],
      confidence: contentKind === "non_film" ? 0.98 : coreTitle.length >= 2 ? (changed ? 0.9 : 0.96) : 0.45,
      note: changed ? "Deterministic cleanup removed promotional or format text" : "Title used without promotional cleanup",
    };
  }
}
