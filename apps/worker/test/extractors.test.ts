import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import {
  parseCinemathequeFilmPage,
  parseHollywoodEventPage,
  parseRioPayload,
  parseViffPage,
} from "../src/extractors/index.js";

describe("Rio Theatre", () => {
  const listing = { id: 350691, event: { id: 350552, title: "Tony", link: "https://riotheatre.ca/movie/tony/" }, start_time: "2026-09-22T18:30:00-07:00", extra: "", premiere: false, tickets_link: "https://riotheatretickets.ca/events/45357-tony" };

  it("maps the Barker REST payload without inventing an end time", () => {
    const result = parseRioPayload([{ ...listing, end_time: "2026-09-22T18:30:00-07:00" }]);
    expect(result[0]).toMatchObject({ sourceUid: "350691", rawTitle: "Tony", ticketUrl: "https://riotheatretickets.ca/events/45357-tony" });
    expect(result[0]?.endsAt).toBeUndefined();
  });

  it("keeps an end time only when it follows the start time", () => {
    expect(parseRioPayload([{ ...listing, end_time: "2026-09-22T20:30:00-07:00" }])[0]?.endsAt).toBe("2026-09-22T20:30:00-07:00");
    expect(parseRioPayload([{ ...listing, end_time: "2026-09-22T17:30:00-07:00" }])[0]?.endsAt).toBeUndefined();
  });

  it("turns the premiere flag and extra text into tags", () => {
    const [showtime] = parseRioPayload([{ ...listing, premiere: true, extra: "  Q&A with director " }]);
    expect(showtime?.tags).toEqual(["premiere", "Q&A with director"]);
  });
});

describe("The Cinematheque", () => {
  it("extracts the Vista screening identifier and local time", () => {
    const html = `<h1>The Samurai and the Prisoner</h1><section id="screeningDates"><a href="https://tickets.thecinematheque.ca/websales/pages/ticketsearchcriteria.aspx?evtinfo=571372~venue&">September 22 <span class="dow">(Tuesday)</span><span class="time pm">7:00</span></a></section>`;
    const [showtime] = parseCinemathequeFilmPage(html, "https://thecinematheque.ca/films/2026/samurai-prisoner");
    expect(showtime).toMatchObject({ sourceUid: "571372", rawTitle: "The Samurai and the Prisoner", startsAt: "2026-09-22T19:00:00-07:00" });
  });
});

describe("VIFF", () => {
  const card = (date: string, time: string) => `<div class="c-event-card"><h3 class="c-event-card__title"><a href="/whats-on/example/">Example Film</a></h3><div class="c-event-instance"><div class="c-event-instance__time">${time}</div><div class="c-event-instance__date"><span>${date}</span></div><span class="c-event-instance__venue">VIFF Cinema</span><button data-eventid="50784" data-instanceid="55880"></button><a class="c-event-instance__btn" href="/whats-on/example/book/opaque">Book now</a></div></div>`;

  it("maps instances and availability independently", () => {
    const [showtime] = parseViffPage(card("Sat Sep 26", "6:10 pm"), "https://viff.org/whats-on/", DateTime.fromISO("2026-09-21", { zone: "America/Vancouver" }));
    expect(showtime).toMatchObject({ sourceUid: "55880", rawTitle: "Example Film", startsAt: "2026-09-26T18:10:00-07:00", ticketUrl: "https://viff.org/whats-on/example/book/opaque" });
  });

  it("rolls a January date over to the next year when the weekday only fits there", () => {
    const [showtime] = parseViffPage(card("Sat Jan 2", "7:00 pm"), "https://viff.org/whats-on/", DateTime.fromISO("2026-12-28", { zone: "America/Vancouver" }));
    expect(showtime?.startsAt).toBe("2027-01-02T19:00:00-08:00");
  });

  it("flags sold out and standby instances", () => {
    const html = card("Sat Sep 26", "6:10 pm").replace("Book now", "Standby only");
    expect(parseViffPage(html, "https://viff.org/whats-on/", DateTime.fromISO("2026-09-21", { zone: "America/Vancouver" }))[0]?.status).toBe("sold_out");
  });
});

describe("Hollywood Theatre", () => {
  it("keeps film events and creates one record per advertised show time", () => {
    const html = `<title>Example Film at Hollywood Theatre</title><meta name="description" content="Example Film September 30, 2026 at Hollywood Theatre"><h1 class="heading-events">Example Film</h1><a href="/categories/film">Film</a><p>DOORS: 6:00pm // SHOW: 7:00pm</p><a href="https://tickets.example.com/example">Get Tickets</a>`;
    const result = parseHollywoodEventPage(html, "https://www.hollywoodtheatre.ca/events/example-film");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ rawTitle: "Example Film", startsAt: "2026-09-30T19:00:00-07:00", ticketUrl: "https://tickets.example.com/example", tags: [] });
  });

  it("keeps secondary categories as tags but not the film gate itself", () => {
    const html = `<meta name="description" content="Concert Film March 1, 2027 at Hollywood Theatre"><h1 class="heading-events">Concert Film</h1><a href="/categories/film">Film</a><a href="/categories/music">Music</a><p>SHOW: 7:00pm</p>`;
    const [showtime] = parseHollywoodEventPage(html, "https://www.hollywoodtheatre.ca/events/concert-film");
    expect(showtime).toMatchObject({ tags: ["music"], startsAt: "2027-03-01T19:00:00-08:00" });
  });

  it("excludes non-film events", () => {
    const html = `<meta name="description" content="Concert September 30, 2026 at Hollywood Theatre"><h1 class="heading-events">Concert</h1><a href="/categories/music">Music</a><p>SHOW: 7:00pm</p>`;
    expect(parseHollywoodEventPage(html, "https://www.hollywoodtheatre.ca/events/concert")).toEqual([]);
  });
});
