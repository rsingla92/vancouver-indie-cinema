import { load } from "cheerio";
import { extractedShowtimeSchema, type ExtractionBatch, type ExtractedShowtime } from "../contracts.js";
import { fetchText } from "../http.js";
import { absoluteUrl, cleanText, iso, mapWithConcurrency, parseDateTime } from "./utils.js";

const BASE = "https://www.hollywoodtheatre.ca";

export function parseHollywoodEventLinks(html: string): string[] {
  const $ = load(html);
  return [...new Set(
    $(".event_item-2 a[href^='/events/'],.event_item-2 a[href^='https://www.hollywoodtheatre.ca/events/']")
      .map((_, element) => absoluteUrl($(element).attr("href")!, BASE))
      .get(),
  )];
}

export function parseHollywoodEventPage(html: string, pageUrl: string): ExtractedShowtime[] {
  const $ = load(html);
  const categories = $("a[href^='/categories/']")
    .map((_, element) => cleanText($(element).text()).toLowerCase())
    .get();
  if (!categories.includes("film")) return [];

  const rawTitle = cleanText($("h1.heading-events").first().text() || $("title").text().split(" at Hollywood")[0]);
  const description = $("meta[name='description']").attr("content") ?? "";
  const dateMatch = description.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})\b/i);
  if (!rawTitle || !dateMatch) return [];

  const bodyText = cleanText($("body").text());
  const showTimes = [...bodyText.matchAll(/\bSHOW\s*:\s*(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))/gi)]
    .map((match) => match[1]!.replaceAll(".", "").replace(/\s*(am|pm)$/i, " $1"));
  const uniqueTimes = [...new Set(showTimes)];
  if (uniqueTimes.length === 0) return [];

  const ticketAnchor = $("a").filter((_, element) => /(?:get|buy)\s*tickets/i.test(cleanText($(element).text()))).first();
  const ticketHref = ticketAnchor.attr("href");
  const slug = new URL(pageUrl).pathname.split("/").filter(Boolean).at(-1)!;

  return uniqueTimes.map((time, index) => {
    const startsAt = parseDateTime(`${dateMatch[1]} ${dateMatch[2]} ${dateMatch[3]} ${time}`, ["LLLL d yyyy h:mm a", "LLLL d yyyy h a"]);
    return extractedShowtimeSchema.parse({
      venueSlug: "hollywood-theatre",
      sourceUid: `${slug}:${index}:${startsAt.toISO()}`,
      rawTitle,
      startsAt: iso(startsAt),
      detailUrl: pageUrl,
      ...(ticketHref ? { ticketUrl: absoluteUrl(ticketHref, pageUrl) } : {}),
      tags: categories,
      sourcePayload: { description, categories, showTimeText: time },
    });
  });
}

export async function extractHollywood(maxPages = 20): Promise<ExtractionBatch> {
  const eventLinks = new Set<string>();
  const warnings: string[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const url = new URL("/events", BASE);
    if (page > 1) url.searchParams.set("8c848147_page", String(page));
    const html = await fetchText(url);
    const links = parseHollywoodEventLinks(html);
    links.forEach((link) => eventLinks.add(link));
    if (!/aria-label=["']Next Page["']/.test(html) || links.length === 0) break;
  }

  const pages = await mapWithConcurrency([...eventLinks], 4, async (url) => {
    try {
      return parseHollywoodEventPage(await fetchText(new URL(url)), url);
    } catch (error) {
      warnings.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  });

  return {
    venueSlug: "hollywood-theatre",
    fetchedAt: new Date().toISOString(),
    showtimes: pages.flat(),
    warnings,
  };
}
