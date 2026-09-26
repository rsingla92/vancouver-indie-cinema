import type { NormalizedTitle } from "./contracts.js";

/**
 * Pattern tables for the deterministic title normalizer. Bump the version whenever a
 * rule changes so replayed raw items can be told apart from earlier runs.
 */
export const NORMALIZATION_RULES_VERSION = "title-rules-v8";

export type Tag = NormalizedTitle["tags"][number];

/** Format and experience labels that become tags and are removed from the title. */
export const TAG_PATTERNS: ReadonlyArray<readonly [Tag, RegExp]> = [
  ["35mm", /\b35\s*mm\b/i],
  ["70mm", /\b70\s*mm\b/i],
  ["16mm", /\b16\s*mm\b/i],
  ["4K", /\b4k\b/i],
  ["re-release", /\bre-?releas(?:e|ed)\b|\bre-?issue[ds]?\b|\brevival\b/i],
  ["Q&A", /\bq\s*(?:&|\+|and)\s*a\b|\bquestions?\s+(?:and|&)\s+answers?\b/i],
  ["restoration", /\b(?:(?:new\s+)?[24]k\s+)?restor(?:ed|ation)\b|\bremaster(?:ed)?\b/i],
  ["sing-along", /\bsing[ -]?along\b/i],
  ["captioned", /\b(?:open\s+)?caption(?:ed|s)?\b|\boc\b/i],
  ["live", /\blive\s+(?:performance|score|music|soundtrack|accompaniment|narration)\b/i],
  // A plain "Q&A with director" is the Q&A tag; "guests" is for explicit guest wording.
  ["guests", /\bspecial\s+guests?\b|\bin\s+conversation\b|\bin\s+attendance\b|\bintro(?:duc(?:ed|tion))?\s+by\b|\bhosted\s+by\b/i],
  ["subtitled", /[(\[]\s*sub(?:bed|titled)?\s*[)\]]|\bsubtitled\b|(?<![\w])v\.?o\.?s\.?t\.?[fa]/i],
  ["dubbed", /[(\[]\s*dub(?:bed)?\s*[)\]]|\bdubbed\b|\benglish\s+dub\b/i],
  ["double bill", /\bdouble\s+(?:feature|bill)\b/i],
];

/** Screenings that are not one film: festivals, shorts programmes. Listed, never matched. */
export const EVENT_PATTERNS = [
  /\bfilm\s+festival\b|\bfestival\s+(?:international\s+)?(?:du|de|of)\s+film/i,
  /\bshorts?\s+(?:forum|program(?:me)?|block)\b|\bfilm\s+project\b|^modes\s+\d+$/i,
];

/** Listings that are events rather than films and must not be matched against TMDB. */
export const NON_FILM_PATTERNS = [
  /\b(?:comedy|trivia|karaoke|quiz|bingo|open\s+mic|drag)\s+(?:night|show)\b/i,
  /\b(?:concert(?!\s+(?:film|doc|documentary|movie))|workshop|lecture|panel\s+discussion|book\s+launch|stand-?up\s+comedy)\b/i,
  /\b(?:dance|after|release|launch|costume|halloween|new\s+year'?s?(?:\s+eve)?|listening|album)\s+party\b/i,
  // Live music with a film is a film ("Faust w/ live music"); on its own it is a gig ("Hayden live at the Revue").
  /\blive\s+(?:podcast|comedy|taping|reading)\b|\blive\s+at\s+the\b/i,
  /\bprivate\s+(?:event|screening|rental|function)\b|\bclosed\s+for\b|\brental\s+event\b/i,
  /\bburlesque\b|\bvariety\s+show\b|\blecture\s+by\b|\bstudent\s+showcase\b|\bjfl\b|\bjust\s+for\s+laughs\b/i,
];

/** Venue series and event labels that precede or accompany a title. */
const PROMO_LABEL =
  "special (?:event|presentation|screening)|encore(?: presentation| screening)?|(?:the )?rio presents|(?:the )?park(?: theatre)? presents|viff presents|" +
  "(?:the )?cinematheque presents|hollywood theatre presents|double (?:feature|bill)|late (?:night|nite)|community screening|" +
  "members?['’]? (?:only )?screening|members? only|film club|cinema club|free screening|free|sneak preview|preview screening|" +
  "preview|opening night|closing night|staff picks?|new (?:[24]k )?restoration|[24]k restoration|[24]k|" +
  "(?:vancouver|toronto|montreal|canadian|west coast|north american|world) (?:theatrical )?premiere|premiere|matinee|all ages|19\\+|sold out|" +
  "cult classics?|movie night|film night|film series|series|" +
  "\\d+(?:st|nd|rd|th)[- ]anniversary(?: (?:screening|edition|celebration|presentation))?|anniversary (?:screening|edition)|" +
  "(?:off-)?viff \\d{4}|\\d+e anniversaire|coups? de c(?:oe|œ)ur(?: de l['’]équipe)?|halloween edition|(?:new )?restoration";

/** "Special Event: Title" */
export const PREFIX_PATTERN = new RegExp(`^(?:${PROMO_LABEL})\\s*[:\\-–—|]\\s*`, "i");

/**
 * "Studio Ghibli Fest: Spirited Away", "Cinema Salon: Tokyo Story": a short series name
 * ending in a series-like word. Words like "club" are deliberately absent because
 * "Fight Club: 35mm" is a title, not a series.
 */
export const SERIES_PREFIX_PATTERN = /^[^:|]{0,60}?\b(?:fest|festival|series|salon|presents|showcase|spotlight|retrospective|marathon)\s*:\s*/i;

/**
 * "Destination Love: COMING TO AMERICA - New Restoration": a series name in mixed
 * case before a title the venue prints in capitals. The first group is the series,
 * the second everything after the colon, which must open with a capitalised word.
 */
export const CAPS_TITLE_AFTER_PREFIX_PATTERN = /^([^:|]{2,60}?):\s+((?:[^a-z]*?\b[A-Z][A-Z0-9'’.&-]+\b)[^a-z]*.*)$/;

/** "Perfect Days — Vancouver Premiere", "Moonlight (Free)" */
export const TRAILING_PROMO_PATTERN = new RegExp(`\\s*[-–—:|(\\[]\\s*(?:${PROMO_LABEL})\\s*[)\\]]?\\s*$`, "i");

/** A whole segment that is only a label, used when a title is split on "|" or "•". */
export const PROMO_SEGMENT_PATTERN = new RegExp(
  `^(?:${PROMO_LABEL}|.*\\bpresents\\b.*|.*\\bseries\\b.*|.*\\bfestival\\b.*|.*\\bshowcase\\b.*|tickets?\\b.*|doors?\\b.*|` +
  "hosted by\\b.*|presented by\\b.*|with\\b.*|featuring\\b.*|feat\\.?\\s.*|q\\s*&\\s*a\\b.*|(?:open )?captioned|sing-?along)$",
  "i",
);
export const SEGMENT_SEPARATOR = /\s*[|•]\s*/;

/** "(OFF-VIFF 2026, West Coast Premiere)": a bracket holding only labels, comma-separated. */
export const PROMO_BRACKET_PATTERN = new RegExp(`\\s*[(\\[]\\s*(?:${PROMO_LABEL})(?:\\s*,\\s*(?:${PROMO_LABEL}))*!?\\s*[)\\]]`, "gi");

/**
 * "Title - Presented on 35mm!", "Title: 4K Restoration!", "Title - Toronto Theatrical
 * Premiere of New Restoration!": once a dash or colon segment contains a label, an
 * edition word or an event word, that whole segment is promotion, not title.
 */
export const PROMO_SEGMENT_SUFFIX_PATTERN = new RegExp(
  `\\s*[-–—:]\\s*[^-–—:]*?\\b(?:${PROMO_LABEL}|presented on|on (?:35|70|16)mm|on dcp|restoration|remaster(?:ed)?|director'?s cut|final cut|` +
  "screening|live (?:performance|music|score)|in attendance|cast (?:&|and) crew|special guests?|shadow ?cast|sing-?along|singalong)\\b[^-–—:]*$",
  "i",
);

const EVENT_SUFFIX = "tickets?|doors?|hosted by|presented by|presented (?:on|in)\\b|with (?:a )?(?:director|filmmaker|guests?|special guests?|(?:the |select )?cast|live|intro|q\\s*&\\s*a)|in attendance|" +
  "in conversation|introduced by|intro(?:duction)? by|followed by|preceded by|plus\\s|q\\s*&\\s*a|q\\s+and\\s+a|" +
  "(?:select )?cast (?:&|and) crew|featuring|live at|shadow ?cast|screening with|screening w/";

/** "Title + Q&A with director", "Title w/ live score", "Title - tickets on sale", "Title (intro by ...)" */
export const SUFFIX_PATTERNS = [
  new RegExp(`\\s*\\+\\s*(?:${EVENT_SUFFIX}|with\\b|w/|discussion|intro(?:duction)?\\b|panel|talk|director|filmmaker|live\\b|pre-?show|post-?show|after-?party|reception|performance|dj\\b|guest).*$`, "i"),
  /\s+w\/\s+.*$/i,
  new RegExp(`\\s*[-–—:,]\\s*(?:${EVENT_SUFFIX}).*$`, "i"),
  /** "Title - North American Premiere with Cast & Crew In Attendance!": once a dash-separated label starts, the title is over. */
  new RegExp(`\\s*[-–—]\\s*(?:${PROMO_LABEL})\\b.*$`, "i"),
  new RegExp(`\\s*[(\\[]\\s*(?:${EVENT_SUFFIX})[^)\\]]*[)\\]]`, "i"),
  /** "Ginger Snaps Screening with Q&A from ...", "Title Screening": the word marks the end of the title. */
  /\s+screening(?:\s+(?:with|w\/|\+|featuring|and)\b.*)?$/i,
  /** "GREASE SINGALONG AND SHADOWCAST!": add-ons joined by "and". */
  /\s+(?:and|&|\+)\s+(?:shadow ?cast|sing-?along|singalong)\b.*$/i,
];

/** "(Filmmakers in Attendance for Q&A)", "(Halloween Edition!)": a bracket about the event, not the film. */
export const EVENT_BRACKET_PATTERN = /\s*[(\[][^)\]]*\b(?:in attendance|q\s*&\s*a|filmmakers?|directors?|cast|crew|live|introduc|hosted|presented|special guests?|shadow ?cast|sing-?along|edition)\b[^)\]]*[)\]]/gi;

/** "(SUB)", "(Dubbed)", "(English subtitles)": how the film is presented, not what it is called. */
export const LANGUAGE_BRACKET_PATTERN = /\s*[(\[]\s*(?:sub(?:bed|titled)?|dub(?:bed)?|english\s+(?:sub(?:title)?s?|dub|audio)|japanese\s+audio|in\s+(?:english|french|japanese)(?:\s+with\s+(?:english|french)\s+subtitles)?)\s*[)\]]/gi;

/** "(Sing-Along + Shadow Cast)" after the tag is removed leaves "( + Shadow Cast)": an add-on, not the title. */
export const CONNECTOR_BRACKET_PATTERN = /[(\[]\s*(?:\+|&|and\b|with\b|w\/)[^)\]]*[)\]]/gi;

/** "(Concert Film)", "(Documentary)": a description of the film, not part of its title. */
export const DESCRIPTOR_BRACKET_PATTERN = /\s*[(\[]\s*(?:concert (?:film|documentary|movie)|documentary|short film|silent film)\s*[)\]]/gi;

/** Montreal listings mark the language version: "(v.o.s.t.f.)", "VOSTA", "V.F.", "version originale". */
export const VERSION_PATTERN = /\s*[(\[]?\s*(?<![\w])(?:v\.?o\.?(?:s\.?t\.?)?(?:[fa]\.?r?)?(?:-\s?(?:s\.?m\.?e\.?|[fa]\.?))?|v\.?f\.?(?:s\.?t\.?a\.?)?|s\.?t\.?[fa]\.?|s\.?m\.?e\.?|version\s+(?:originale|française|francaise|anglaise)(?:\s+sous-titrée(?:\s+en\s+(?:français|anglais))?)?)(?![\w])\s*[)\]]?/gi;

/** Release and print descriptions: "4K", "Director's Cut", "new print". */
export const EDITION_PATTERN = /\s*[(\[]?\s*\b(?:\d{4}\s+(?:restoration|remaster(?:ed)?|re-?release|re-?issue|edition|version|print)|[24]k(?:\s+(?:digital\s+)?(?:restoration|remaster|scan|dcp|print))?|remastered|restored|new\s+restoration|(?:the\s+)?director'?s\s+cut|(?:the\s+)?final\s+cut|extended\s+(?:cut|edition|version)|theatrical\s+(?:cut|version)|imax|dcp|digital\s+restoration|new\s+print|archival\s+print|\d{2}mm\s+print|re-?release[ds]?|re-?issue[ds]?|revival)\b\s*[)\]]?/gi;

/** Only a year the listing sets apart counts: "(1978)" or "– 1978", never "2001: A Space Odyssey". */
export const BRACKETED_YEAR = /[(\[]\s*((?:18|19|20)\d{2})\s*[)\]]/;
export const TRAILING_YEAR = /[,\-–—:|]\s*((?:18|19|20)\d{2})\s*$/;

/** "()", "( !)", "(2026 )": a bracket with nothing left in it but punctuation or a lone year. */
export const EMPTY_BRACKETS = /[(\[]\s*(?:\d{4})?\s*[!?.,;:\-–—+&]*\s*[)\]]/g;
export const EDGE_SEPARATORS = /^[\s:|\-–—+•,]+|[\s:|\-–—+•,]+$/g;
export const DANGLING_CONNECTOR = /\s+(?:with|and|&|featuring|feat\.?|w\/)\s*$/i;
