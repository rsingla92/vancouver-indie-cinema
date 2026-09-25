/**
 * Agile Ticketing sells for the Revue and the Fox. Agile's own websales pages
 * (list.aspx, feed.ashx) sit behind Incapsula bot protection and answer every
 * server-side request with a block page, so the schedule comes from each venue's
 * WordPress site, which prints Agile links per screening or per film. This module
 * holds what the two extractors share: recognising those links and reading the
 * Agile event id out of them.
 */

/** `...aspx?evtinfo=657612~3cc021f8-...`: the number before the tilde is Agile's event id. */
const EVTINFO = /[?&]evtinfo=(\d+)(?:~|%7e)/i;

export function agileEventId(href: string | undefined): string | undefined {
  return href?.match(EVTINFO)?.[1];
}

/** Absolute https link with the trailing "&" WordPress leaves after `&#038;` removed. */
export function cleanAgileUrl(href: string, base: string): string {
  const url = new URL(href, base);
  url.protocol = "https:";
  return url.toString().replace(/[&?]$/, "");
}

export function isAgileTicketLink(href: string | undefined): boolean {
  return Boolean(href && /\/websales\/pages\/[a-z]+\.aspx/i.test(href) && EVTINFO.test(href));
}
