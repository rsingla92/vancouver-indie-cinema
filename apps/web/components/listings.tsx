import { Poster } from "./poster";
import { Stamp } from "./stamp";
import { formatClock } from "@/lib/format";
import type { DateWindow, FilmListing } from "@/lib/showtimes";
import type { TheatreRef } from "@/lib/types";

interface ListingsProps {
  listings: FilmListing[];
  theatres: TheatreRef[];
  venue: string;
  onVenueChange: (slug: string) => void;
  windows: DateWindow[];
  when: string;
  onWhenChange: (id: string) => void;
  timezone: string;
  demo: boolean;
}

/** "Showtimes": one row per film, a small poster beside its screenings grouped by day. */
export function Listings({ listings, theatres, venue, onVenueChange, windows, when, onWhenChange, timezone, demo }: ListingsProps) {
  return <section className="showtimes" id="showtimes">
    <h2 className="rule-heading"><span>Showtimes</span></h2>
    <div className="filters">
      <label className="filter cinema-select">Cinema <select value={venue} onChange={(event) => onVenueChange(event.target.value)}>
        <option value="all">All cinemas</option>
        {theatres.map((theatre) => <option key={theatre.slug} value={theatre.slug}>{theatre.name}</option>)}
      </select></label>
      <label className="filter when-select">When <select value={when} onChange={(event) => onWhenChange(event.target.value)}>
        {windows.map((window) => <option key={window.id} value={window.id}>{window.label}</option>)}
      </select></label>
    </div>
    {demo && <p className="notice"><b>Sample listings.</b> Set DATABASE_URL to show the live schedule.</p>}
    {listings.length === 0
      ? <p className="empty">No showtimes in this range.</p>
      : <ol className="listing">{listings.map(({ film, tags, days }) =>
        <li className="film" key={film.movieId}>
          <div className="thumb"><Poster movie={film} /></div>
          <div className="film-body">
            <h3 className="film-title">{film.title}{film.year && <span className="film-year">{film.year}</span>}</h3>
            {tags.length > 0 && <p className="film-tags">{tags.map((tag) => <Stamp key={tag}>{tag}</Stamp>)}</p>}
            <dl className="days">{days.map((day) =>
              <div key={day.key}>
                <dt>{day.label}</dt>
                <dd>{day.showtimes.map((showtime, index) =>
                  <span className="showing" key={showtime.id}>
                    {index > 0 && " · "}
                    <a className={showtime.status === "sold_out" ? "time sold" : "time"} href={showtime.ticketUrl} target="_blank" rel="noreferrer" aria-label={`${film.title}, ${formatClock(showtime.startsAt, timezone)} at ${showtime.theatre.name}, tickets`}>{formatClock(showtime.startsAt, timezone)}</a>
                    {" "}<span className="venue">{showtime.theatre.name}</span>
                    {showtime.status === "sold_out" && <> <Stamp tone="red">Sold out</Stamp></>}
                  </span>)}</dd>
              </div>)}</dl>
          </div>
        </li>)}</ol>}
  </section>;
}
