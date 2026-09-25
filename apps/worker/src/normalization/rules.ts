import type { NormalizedTitle } from "./contracts.js";

/**
 * Pattern tables for the deterministic title normalizer. Bump the version whenever a
 * rule changes so replayed raw items can be told apart from earlier runs.
 */
export const NORMALIZATION_RULES_VERSION = "title-rules-v4";

export type Tag = NormalizedTitle["tags"][number];

/** Format and experience labels that become tags and are removed from the title. */
export const TAG_PATTERNS: ReadonlyArray<readonly [Tag, RegExp]> = [
  ["35mm", /\b35\s*mm\b/i],
  ["70mm", /\b70\s*mm\b/i],
  ["16mm", /\b16\s*mm\b/i],
  ["Q&A", /\bq\s*(?:&|\+|and)\s*a\b|\bquestions?\s+(?:and|&)\s+answers?\b/i],
  ["restoration", /\b(?:(?:new\s+)?[24]k\s+)?restor(?:ed|ation)\b|\bremaster(?:ed)?\b/i],
  ["sing-along", /\bsing[ -]?along\b/i],
  ["captioned", /\b(?:open\s+)?caption(?:ed|s)?\b|\boc\b/i],
  ["live", /\blive\s+(?:performance|score|music|soundtrack|accompaniment|narration)\b/i],
];

/** Listings that are events rather than films and must not be matched against TMDB. */
export const NON_FILM_PATTERNS = [
  /\b(?:comedy|trivia|karaoke|quiz|bingo|open\s+mic|drag)\s+(?:night|show)\b/i,
  /\b(?:concert(?!\s+(?:film|doc|documentary|movie))|workshop|lecture|panel\s+discussion|book\s+launch|stand-?up\s+comedy)\b/i,
  /\b(?:dance|after|release|launch|costume|halloween|new\s+year'?s?(?:\s+eve)?|listening|album)\s+party\b/i,
  /\blive\s+(?:music|podcast|performance|comedy|taping|reading)\b/i,
  /\bprivate\s+(?:event|screening|rental|function)\b/i,
];

/** Venue series and event labels that precede or accompany a title. */
const PROMO_LABEL =
  "special (?:event|presentation|screening)|encore(?: presentation| screening)?|(?:the )?rio presents|(?:the )?park(?: theatre)? presents|viff presents|" +
  "(?:the )?cinematheque presents|hollywood theatre presents|double (?:feature|bill)|late (?:night|nite)|community screening|" +
  "members?['’]? (?:only )?screening|members? only|film club|cinema club|free screening|free|sneak preview|preview screening|" +
  "preview|opening night|closing night|staff picks?|new (?:[24]k )?restoration|[24]k restoration|[24]k|" +
  "(?:vancouver|canadian|west coast|north american|world) premiere|premiere|matinee|all ages|19\\+|sold out|" +
  "cult classics?|movie night|film night|film series|series|" +
  "\\d+(?:st|nd|rd|th)[- ]anniversary(?: (?:screening|edition|celebration|presentation))?|anniversary (?:screening|edition)";

/** "Special Event: Title" */
export const PREFIX_PATTERN = new RegExp(`^(?:${PROMO_LABEL})\\s*[:\\-–—|]\\s*`, "i");

/**
 * "Studio Ghibli Fest: Spirited Away", "Cinema Salon: Tokyo Story": a short series name
 * ending in a series-like word. Words like "club" are deliberately absent because
 * "Fight Club: 35mm" is a title, not a series.
 */
export const SERIES_PREFIX_PATTERN = /^[^:|]{0,60}?\b(?:fest|festival|series|salon|presents|showcase|spotlight|retrospective|marathon)\s*:\s*/i;

/** "Perfect Days — Vancouver Premiere", "Moonlight (Free)" */
export const TRAILING_PROMO_PATTERN = new RegExp(`\\s*[-–—:|(\\[]\\s*(?:${PROMO_LABEL})\\s*[)\\]]?\\s*$`, "i");

/** A whole segment that is only a label, used when a title is split on "|" or "•". */
export const PROMO_SEGMENT_PATTERN = new RegExp(
  `^(?:${PROMO_LABEL}|.*\\bpresents\\b.*|.*\\bseries\\b.*|.*\\bfestival\\b.*|.*\\bshowcase\\b.*|tickets?\\b.*|doors?\\b.*|` +
  "hosted by\\b.*|presented by\\b.*|with\\b.*|featuring\\b.*|feat\\.?\\s.*|q\\s*&\\s*a\\b.*|(?:open )?captioned|sing-?along)$",
  "i",
);
export const SEGMENT_SEPARATOR = /\s*[|•]\s*/;

const EVENT_SUFFIX = "tickets?|doors?|hosted by|presented by|with (?:director|filmmaker|guests?|special guests?|live|intro|q\\s*&\\s*a)|" +
  "in conversation|introduced by|intro(?:duction)? by|followed by|preceded by|plus\\s|q\\s*&\\s*a|q\\s+and\\s+a";

/** "Title + Q&A with director", "Title w/ live score", "Title - tickets on sale", "Title (intro by ...)" */
export const SUFFIX_PATTERNS = [
  new RegExp(`\\s*\\+\\s*(?:${EVENT_SUFFIX}|with\\b|w/|discussion|intro(?:duction)?\\b|panel|talk|director|filmmaker|live\\b|pre-?show|post-?show|after-?party|reception|performance|dj\\b|guest).*$`, "i"),
  /\s+w\/\s+.*$/i,
  new RegExp(`\\s*[-–—:,]\\s*(?:${EVENT_SUFFIX}).*$`, "i"),
  new RegExp(`\\s*[(\\[]\\s*(?:${EVENT_SUFFIX})[^)\\]]*[)\\]]`, "i"),
];

/** "(Sing-Along + Shadow Cast)" after the tag is removed leaves "( + Shadow Cast)": an add-on, not the title. */
export const CONNECTOR_BRACKET_PATTERN = /[(\[]\s*(?:\+|&|and\b|with\b|w\/)[^)\]]*[)\]]/gi;

/** "(Concert Film)", "(Documentary)": a description of the film, not part of its title. */
export const DESCRIPTOR_BRACKET_PATTERN = /\s*[(\[]\s*(?:concert (?:film|documentary|movie)|documentary|short film|silent film)\s*[)\]]/gi;

/** Montreal listings mark the language version: "(v.o.s.t.f.)", "VOSTA", "V.F.", "version originale". */
export const VERSION_PATTERN = /\s*[(\[]?\s*(?<![\w])(?:v\.?o\.?s\.?t\.?[fa]\.?|v\.?o\.?[af]\.?|v\.?o\.?|v\.?f\.?|s\.?t\.?[fa]\.?|version\s+(?:originale|française|francaise|anglaise)(?:\s+sous-titrée(?:\s+en\s+(?:français|anglais))?)?)(?![\w])\s*[)\]]?/gi;

/** Release and print descriptions: "4K", "Director's Cut", "new print". */
export const EDITION_PATTERN = /\s*[(\[]?\s*\b(?:[24]k(?:\s+(?:digital\s+)?(?:restoration|remaster|scan|dcp|print))?|remastered|restored|new\s+restoration|director'?s\s+cut|final\s+cut|extended\s+(?:cut|edition|version)|theatrical\s+(?:cut|version)|imax|dcp|digital\s+restoration|new\s+print|archival\s+print|\d{2}mm\s+print|re-?release[ds]?|re-?issue[ds]?|revival)\b\s*[)\]]?/gi;

/** Only a year the listing sets apart counts: "(1978)" or "– 1978", never "2001: A Space Odyssey". */
export const BRACKETED_YEAR = /[(\[]\s*((?:18|19|20)\d{2})\s*[)\]]/;
export const TRAILING_YEAR = /[,\-–—:|]\s*((?:18|19|20)\d{2})\s*$/;

export const EMPTY_BRACKETS = /\(\s*\)|\[\s*\]/g;
export const EDGE_SEPARATORS = /^[\s:|\-–—+•,]+|[\s:|\-–—+•,]+$/g;
export const DANGLING_CONNECTOR = /\s+(?:with|and|&|featuring|feat\.?|w\/)\s*$/i;
