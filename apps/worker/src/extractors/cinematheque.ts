import { load } from "cheerio";
import { DateTime } from "luxon";
import { extractedShowtimeSchema, type ExtractionBatch, type ExtractedShowtime } from "../contracts.js";
import { fetchText } from "../http.js";
import { absoluteUrl, cleanText, iso, mapWithConcurrency, parseDateTime, VANCOUVER_TZ } from "./utils.js";

const BASE = "https://thecinematheque.ca";

export function parseCinemathequeFilmPage(html: string, pageUrl: string): ExtractedShowtime[] {
  const $ = load(html);
  const rawTitle = cleanText($(".filmTitle").first().text() || $("h1").first().text() || $("title").text().split("|")[0]);
  const yearMatch = new URL(pageUrl).pathname.match(/\/films\/(\d{4})\//);
  const year = yearMatch ? Number(yearMatch[1]) : DateTime.now().setZone(VANCOUVER_TZ).year;
  const output: ExtractedShowtime[] = [];

  $("#screeningDates a[href*='evtinfo=']").each((_, element) => {
    const anchor = $(element);
    const ticketUrl = absoluteUrl(anchor.attr("href")!, pageUrl);
    const evtInfo = new URL(ticketUrl).searchParams.get("evtinfo")?.split("~")[0];
    const monthDay = cleanText(anchor.clone().find(".dow,.time").remove().end().text());
    const time = cleanText(anchor.find(".time").text());
    const period = anchor.find(".time").hasClass("pm") ? "pm" : "am";
    const startsAt = parseDateTime(`${monthDay} ${time} ${period}`, ["LLLL d h:mm a", "LLL d h:mm a"], { year });

    output.push(extractedShowtimeSchema.parse({
      venueSlug: "the-cinematheque",
      sourceUid: evtInfo ?? `${new URL(pageUrl).pathname}:${startsAt.toISO()}`,
      rawTitle,
      startsAt: iso(startsAt),
      detailUrl: pageUrl,
      ticketUrl,
      tags: [],
      sourcePayload: { evtInfo, pageUrl, screeningText: cleanText(anchor.text()) },
    }));
  });

  return output;
}

export function parseCinemathequeFilmLinks(html: string): string[] {
  const $ = load(html);
  return [...new Set(
    $("a[href^='/films/'],a[href^='https://thecinematheque.ca/films/']")
      .map((_, element) => absoluteUrl($(element).attr("href")!, BASE))
      .get()
      .filter((url) => /\/films\/\d{4}\//.test(url)),
  )];
}

export async function extractCinematheque(): Promise<ExtractionBatch> {
  const indexUrl = new URL("/films", BASE);
  const links = parseCinemathequeFilmLinks(await fetchText(indexUrl));
  const warnings: string[] = [];
  const pages = await mapWithConcurrency(links, 4, async (url) => {
    try {
      return parseCinemathequeFilmPage(await fetchText(new URL(url)), url);
    } catch (error) {
      warnings.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  });

  return {
    venueSlug: "the-cinematheque",
    fetchedAt: new Date().toISOString(),
    showtimes: pages.flat(),
    warnings,
  };
}
