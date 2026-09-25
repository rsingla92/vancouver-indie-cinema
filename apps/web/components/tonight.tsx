import { Still } from "./poster";
import { Stamp } from "./stamp";
import { dateKey, formatClock, formatDay } from "@/lib/format";
import type { ShowtimeView } from "@/lib/types";

interface TonightProps {
  film: ShowtimeView | undefined;
  city: string;
  now: Date;
  timezone: string;
  searching: boolean;
}

/** The featured screening: the next film to start in the chosen city. */
export function Tonight({ film, city, now, timezone, searching }: TonightProps) {
  if (!film) {
    return <section className="tonight" id="tonight" aria-labelledby="tonight-title">
      <div className="tonight-label"><Stamp>{city}</Stamp></div>
      <h1 id="tonight-title">No films found</h1>
      <p className="blurb">{searching ? "Nothing matches your search." : "No upcoming screenings."}</p>
    </section>;
  }

  const tonight = dateKey(film.startsAt, timezone) === dateKey(now, timezone);
  return <section className="tonight" id="tonight" aria-labelledby="tonight-title">
    <div className="tonight-label"><Stamp tone="red">{tonight ? "Tonight" : "Coming up"}</Stamp><span className="mono">{formatDay(film.startsAt, timezone)} · {formatClock(film.startsAt, timezone)}</span></div>
    <div className="tonight-body">
      <Still movie={film} />
      <h1 id="tonight-title">{film.title}</h1>
      {film.synopsis && <p className="blurb">{film.synopsis}</p>}
      <dl className="facts">
        <div><dt>Where</dt><dd>{film.theatre.name}</dd></div>
        <div><dt>When</dt><dd>{formatDay(film.startsAt, timezone)}, {formatClock(film.startsAt, timezone)}</dd></div>
        {film.year && <div><dt>Year</dt><dd>{film.year}</dd></div>}
      </dl>
      <a className="cta" href={film.ticketUrl} target="_blank" rel="noreferrer">
        {film.status === "sold_out" ? "Sold out" : `Buy tickets at ${film.theatre.name}`}
      </a>
    </div>
  </section>;
}
