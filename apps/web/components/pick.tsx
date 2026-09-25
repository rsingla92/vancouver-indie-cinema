import { Poster } from "./poster";
import { Stamp } from "./stamp";
import { dateKey, formatClock, formatDay } from "@/lib/format";
import { shortSynopsis } from "@/lib/showtimes";
import type { ShowtimeView } from "@/lib/types";

interface PickProps {
  film: ShowtimeView | undefined;
  city: string;
  now: Date;
  timezone: string;
  searching: boolean;
  /** Re-rolls the pick; absent when there is nothing else to pick. */
  onPickAnother?: () => void;
}

/** The featured screening: a random pick from the films on show in the chosen city. */
export function Pick({ film, city, now, timezone, searching, onPickAnother }: PickProps) {
  const heading = <h2 className="rule-heading">
    <span>Pick</span>
    {onPickAnother && <button type="button" className="textlink pick-another" onClick={onPickAnother}>[ pick another ]</button>}
  </h2>;

  if (!film) {
    return <section className="pick" id="pick" aria-labelledby="pick-title">
      {heading}
      <div className="pick-body">
        <div className="pick-text">
          <p className="pick-when mono">{city}</p>
          <h1 id="pick-title">No films found</h1>
          <p className="blurb">{searching ? "Nothing matches your search." : "No upcoming screenings."}</p>
        </div>
      </div>
    </section>;
  }

  const today = dateKey(film.startsAt, timezone) === dateKey(now, timezone);
  return <section className="pick" id="pick" aria-labelledby="pick-title">
    {heading}
    <div className="pick-body">
      <div className="pick-poster"><Poster movie={film} /></div>
      <div className="pick-text">
        <p className="pick-when mono">{today && <><Stamp tone="red">Today</Stamp>{" "}</>}{formatDay(film.startsAt, timezone)} · {formatClock(film.startsAt, timezone)}</p>
        <h1 id="pick-title">{film.title}</h1>
        {film.synopsis && <p className="blurb">{shortSynopsis(film.synopsis)}</p>}
        <dl className="facts">
          <div><dt>Where</dt><dd>{film.theatre.name}</dd></div>
          <div><dt>When</dt><dd>{formatDay(film.startsAt, timezone)}, {formatClock(film.startsAt, timezone)}</dd></div>
          {film.year && <div><dt>Year</dt><dd>{film.year}</dd></div>}
        </dl>
        <a className="cta" href={film.ticketUrl} target="_blank" rel="noreferrer">
          {film.status === "sold_out" ? "Sold out" : `Buy tickets at ${film.theatre.name}`}
        </a>
      </div>
    </div>
  </section>;
}
