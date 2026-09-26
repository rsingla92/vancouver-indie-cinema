import { filenameParse } from "@ctrl/video-filename-parser";
import type { NormalizedTitle, TitleNormalizer } from "./contracts.js";
import {
  BRACKETED_YEAR, CAPS_TITLE_AFTER_PREFIX_PATTERN, CONNECTOR_BRACKET_PATTERN, DANGLING_CONNECTOR, DESCRIPTOR_BRACKET_PATTERN, EDGE_SEPARATORS,
  EDITION_PATTERN, EMPTY_BRACKETS, EVENT_BRACKET_PATTERN, EVENT_PATTERNS, LANGUAGE_BRACKET_PATTERN, NON_FILM_PATTERNS, PREFIX_PATTERN,
  PROMO_BRACKET_PATTERN, PROMO_SEGMENT_PATTERN, PROMO_SEGMENT_SUFFIX_PATTERN, SEGMENT_SEPARATOR,
  SERIES_PREFIX_PATTERN, SUFFIX_PATTERNS, TAG_PATTERNS, TRAILING_PROMO_PATTERN, TRAILING_YEAR, VERSION_PATTERN,
} from "./rules.js";
import { canonicalTitle } from "./text.js";

export { NORMALIZATION_RULES_VERSION } from "./rules.js";

function tidy(value: string): string {
  return value.replace(EMPTY_BRACKETS, " ").replace(/\s+/g, " ").replace(EDGE_SEPARATORS, "").replace(DANGLING_CONNECTOR, "").trim();
}

/** True when a piece of text carries no title, only labels, tags or edition words. */
function isPromotionalSegment(segment: string): boolean {
  if (PROMO_SEGMENT_PATTERN.test(segment)) return true;
  let rest = segment.replace(EDITION_PATTERN, " ").replace(DESCRIPTOR_BRACKET_PATTERN, " ").replace(VERSION_PATTERN, " ");
  for (const [, pattern] of TAG_PATTERNS) rest = rest.replace(pattern, " ");
  return tidy(rest) === "";
}

/** "Eraserhead | Late Night" → "Eraserhead"; "VIFF Presents | Perfect Days" → "Perfect Days". */
function chooseSegment(value: string): string {
  const segments = value.split(SEGMENT_SEPARATOR).map((segment) => segment.trim()).filter(Boolean);
  if (segments.length <= 1) return value;
  return segments.find((segment) => !isPromotionalSegment(segment)) ?? segments[0]!;
}

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

/** Strip venue and series prefixes, keeping a title that merely ends in a series-like word. */
function stripPrefixes(value: string): string {
  let cleaned = value;
  for (let pass = 0; pass < 3; pass += 1) {
    if (PREFIX_PATTERN.test(cleaned)) {
      cleaned = cleaned.replace(PREFIX_PATTERN, "");
      continue;
    }
    const series = cleaned.match(SERIES_PREFIX_PATTERN);
    if (series) {
      const remainder = cleaned.slice(series[0].length);
      if (isPromotionalSegment(remainder)) break;
      cleaned = remainder;
      continue;
    }
    // "Christmas Classics: ERNEST SAVES CHRISTMAS": the series is in mixed case, the title in capitals.
    const caps = cleaned.match(CAPS_TITLE_AFTER_PREFIX_PATTERN);
    if (!caps || !/[a-z]/.test(caps[1]!) || isPromotionalSegment(caps[2]!)) break;
    cleaned = caps[2]!;
  }
  return cleaned;
}

/**
 * "Klassic Kidz: ParaNorman", "Scream Queens: Us": a short series label before
 * the title, which nothing in the words themselves gives away. The pipeline
 * retries a failed match with this remainder.
 */
export function titleAfterSeriesLabel(coreTitle: string): string | null {
  const match = coreTitle.match(/^([^:|]{2,40}?):\s+(.{2,})$/);
  if (!match) return null;
  const [, label, rest] = match;
  if (label!.trim().split(/\s+/).length > 4 || /^\d+$/.test(rest!.trim())) return null;
  return rest!.trim();
}

function stripSuffixes(value: string): string {
  let cleaned = value.replace(PROMO_BRACKET_PATTERN, " ").replace(LANGUAGE_BRACKET_PATTERN, " ").replace(VERSION_PATTERN, " ").replace(EVENT_BRACKET_PATTERN, " ");
  for (const pattern of SUFFIX_PATTERNS) cleaned = cleaned.replace(pattern, "");
  for (let pass = 0; pass < 2 && PROMO_SEGMENT_SUFFIX_PATTERN.test(cleaned); pass += 1) cleaned = cleaned.replace(PROMO_SEGMENT_SUFFIX_PATTERN, "");
  for (let pass = 0; pass < 2 && TRAILING_PROMO_PATTERN.test(cleaned); pass += 1) cleaned = cleaned.replace(TRAILING_PROMO_PATTERN, "");
  for (const [, pattern] of TAG_PATTERNS) cleaned = cleaned.replace(pattern, " ");
  return tidy(cleaned.replace(EDITION_PATTERN, " ").replace(DESCRIPTOR_BRACKET_PATTERN, " ").replace(CONNECTOR_BRACKET_PATTERN, " "));
}

/** "Hellraiser + Hellbound" on a double bill: the first film stands for the screening. */
function firstOfDoubleBill(value: string): string {
  const separator = /\s+\+\s+/.test(value) ? /\s+\+\s+/ : /\s+&\s+/;
  const [first] = value.split(separator);
  return first?.trim() || value;
}

const ALTERNATE_BRACKET = /\s*[(\[]([^)\]]{3,60})[)\]]/g;
const NOT_A_TITLE = /^\s*(?:part|partie|episodes?|season|vol\.?|volume)\b|^[\d\s.:-]+$/i;
/** "(Partie 2)", "(Part II)": numbering TMDB writes into the title differently, if at all. */
const PART_BRACKET = /\s*[(\[]\s*(?:part|partie|vol\.?|volume)\s+(?:\d+|[ivx]+)\s*[)\]]/gi;
/** "Ken Russell's The Devils", "Warren Miller's DAYS OFF": a two- or three-word name in the possessive before the title. */
const DIRECTOR_CREDIT = /^((?:[A-Z][\w.'’-]+\s+){1,2}[A-Z][\w.-]+)['’][sS]\s+(.{3,})$/;

/**
 * Other names the listing gives the same film. A bracketed phrase that is not a label,
 * edition or event is usually the original-language title ("Agridulce (Bittersweet)").
 * A director credit in the possessive may or may not be part of TMDB's title, so the
 * bare title is offered as an alternative rather than replacing it.
 */
function extractAlternates(value: string): { rest: string; alternates: string[] } {
  const alternates: string[] = [];
  const numbered = PART_BRACKET.test(value);
  PART_BRACKET.lastIndex = 0;
  const rest = value.replace(PART_BRACKET, " ").replace(ALTERNATE_BRACKET, (match, inner: string, offset: number) => {
    const text = inner.trim();
    if (offset === 0 || !/[a-z]/i.test(text) || NOT_A_TITLE.test(text) || isPromotionalSegment(text)) return match;
    alternates.push(text);
    return " ";
  });
  const credit = tidy(rest).match(DIRECTOR_CREDIT);
  if (credit) alternates.push(credit[2]!);
  // A numbered part is often listed under the series name alone: "La Bataille de Gaulle".
  const series = numbered ? tidy(rest).split(/\s*:\s*/)[0] : undefined;
  if (series && series !== tidy(rest)) alternates.push(series);
  return { rest, alternates };
}

/**
 * Radarr-style parsing is a final safety net for release-style suffixes. It is only
 * trusted when it merely trims the end of the title and did not mistake part of the
 * title (e.g. "Blade Runner 2049") for a release year.
 */
function trimReleaseSuffix(value: string): string {
  const parsed = filenameParse(value);
  const parsedTitle = parsed.title?.trim() ?? "";
  const trusted = parsedTitle && !parsed.year && value.toLowerCase().startsWith(parsedTitle.toLowerCase());
  return tidy(trusted ? parsedTitle : value);
}

export class DeterministicTitleNormalizer implements TitleNormalizer {
  constructor(private readonly now: () => Date = () => new Date()) {}

  normalize(rawTitle: string): NormalizedTitle {
    const tags = TAG_PATTERNS.filter(([, pattern]) => pattern.test(rawTitle)).map(([tag]) => tag);
    const contentKind = NON_FILM_PATTERNS.some((pattern) => pattern.test(rawTitle)) ? "non_film"
      : EVENT_PATTERNS.some((pattern) => pattern.test(rawTitle)) ? "unknown" : "film";

    // NFC, not NFKC: "8½" and "Doppelgängers³" are how TMDB spells them too.
    const normalizedRaw = rawTitle.normalize("NFC").replace(/\s+/g, " ").trim();
    const { year: releaseYear, rest: dated } = extractExplicitYear(normalizedRaw, this.now().getFullYear() + 1);
    // On a double bill the first film stands for the screening; split before any label rule can misread the join.
    const rest = tags.includes("double bill") ? firstOfDoubleBill(dated) : dated;
    const { rest: withoutAlternates, alternates } = extractAlternates(chooseSegment(stripPrefixes(rest)));
    const coreTitle = trimReleaseSuffix(stripSuffixes(withoutAlternates)) || rawTitle.trim();

    const changed = canonicalTitle(coreTitle) !== canonicalTitle(rawTitle);
    return {
      coreTitle,
      releaseYear,
      contentKind,
      tags: [...new Set(tags)],
      ...(alternates.length > 0 ? { alternateTitles: alternates.map((title) => tidy(stripSuffixes(title))).filter(Boolean) } : {}),
      confidence: contentKind === "non_film" ? 0.98 : coreTitle.length >= 2 ? (changed ? 0.9 : 0.96) : 0.45,
      note: changed ? "Deterministic cleanup removed promotional or format text" : "Title used without promotional cleanup",
    };
  }
}
