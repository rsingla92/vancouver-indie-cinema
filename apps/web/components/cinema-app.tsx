"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { formatClock, formatDay, formatLongDay, vancouverDateKey } from "@/lib/format";
import { readSaved, toggleSaved, writeSaved, type SavedFilm } from "@/lib/saved";
import { firstShowtimePerMovie, matchesQuery } from "@/lib/showtimes";
import type { ShowtimeView } from "@/lib/types";

const TICKER_LIMIT = 8;

type NavTab = "tonight" | "showtimes" | "saved";
const NAV: ReadonlyArray<{ id: NavTab; href: string; label: string }> = [
  { id: "tonight", href: "#tonight", label: "Now playing" },
  { id: "showtimes", href: "#showtimes", label: "Schedule" },
  { id: "saved", href: "#saved", label: "Saved" },
];

function Stamp({ children, tone = "ink" }: { children: ReactNode; tone?: "ink" | "red" }) {
  return <em className={`stamp ${tone}`}>{children}</em>;
}

function Poster({ movie }: { movie: ShowtimeView }) {
  const [failed, setFailed] = useState(false);
  if (!movie.posterUrl || failed) {
    return <div className="poster-fallback" aria-hidden="true"><span>no poster</span><b>{movie.title}</b></div>;
  }
  return <img src={movie.posterUrl} alt={`${movie.title} poster`} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}

function Still({ movie }: { movie: ShowtimeView }) {
  const [failed, setFailed] = useState(false);
  if (!movie.backdropUrl || failed) return null;
  return <figure className="still">
    <img src={movie.backdropUrl} alt="" decoding="async" onError={() => setFailed(true)} />
    <figcaption>{movie.title}{movie.year ? ` (${movie.year})` : ""}</figcaption>
  </figure>;
}

interface CinemaAppProps {
  initialShowtimes: ShowtimeView[];
  demo: boolean;
  /** Server timestamp of the listing snapshot; also anchors "tonight" so server and client agree. */
  generatedAt: string;
}

export function CinemaApp({ initialShowtimes, demo, generatedAt }: CinemaAppProps) {
  const [venue, setVenue] = useState("all");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<SavedFilm[]>([]);
  const [tab, setTab] = useState<NavTab>("tonight");

  useEffect(() => { setSaved(readSaved(initialShowtimes)); }, [initialShowtimes]);

  const isSavedId = (movieId: string) => saved.some((film) => film.movieId === movieId);
  const toggle = (item: ShowtimeView) => setSaved((current) => {
    const next = toggleSaved(current, { movieId: item.movieId, title: item.title, theatre: item.theatre.name });
    writeSaved(next);
    return next;
  });

  const theatres = useMemo(() => Array.from(new Map(initialShowtimes.map((item) => [item.theatre.slug, item.theatre])).values()), [initialShowtimes]);
  const searching = query.trim().length > 0;
  const visible = useMemo(() => initialShowtimes.filter((item) => (venue === "all" || item.theatre.slug === venue) && matchesQuery(item, query)), [initialShowtimes, venue, query]);
  const movies = useMemo(() => firstShowtimePerMovie(visible), [visible]);
  // Each saved film with its next screening, or null when nothing is coming up.
  const savedRows = useMemo(() => {
    const upcoming = new Map(firstShowtimePerMovie(initialShowtimes).map((item) => [item.movieId, item]));
    return saved.map((film) => ({ film, next: upcoming.get(film.movieId) ?? null }));
  }, [initialShowtimes, saved]);

  const featured = movies[0];
  const featuredTonight = featured ? vancouverDateKey(featured.startsAt) === vancouverDateKey(generatedAt) : false;
  const ticker = initialShowtimes.slice(0, TICKER_LIMIT).map((item) => `${formatClock(item.startsAt)} ${item.title} at ${item.theatre.name}`).join("   |   ");

  return <div className="zine">
    {ticker && <div className="ticker" aria-hidden="true"><div className="ticker-track">{ticker}</div></div>}

    <header className="masthead">
      <div className="dateline"><span>Vancouver, B.C.</span><span>{formatLongDay(generatedAt)}</span><span>Updated {formatClock(generatedAt)}</span></div>
      <a className="brand" href="#top" aria-label="IndieScreen home"><span>Indie</span>Screen</a>
      <p className="tagline">{theatres.length > 0 ? theatres.map((item) => item.name).join(" · ") : "Independent cinema showtimes"}</p>
      <nav className="menu" aria-label="Primary navigation">
        {NAV.map(({ id, href, label }) => <a key={id} href={href} className={tab === id ? "current" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>[ {label} ]</a>)}
      </nav>
      <form className="searchbox" role="search" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="film-search">Search</label>
        <div className="searchbox-row">
          <input id="film-search" type="search" value={query} placeholder="Film or cinema" onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setQuery(""); }} />
          <button type="submit">Go</button>
          {searching && <button type="button" className="textlink" onClick={() => setQuery("")}>clear</button>}
        </div>
      </form>
    </header>

    <main>
      <section className="tonight" id="tonight" aria-labelledby="tonight-title">
        {featured ? <>
          <div className="tonight-label"><Stamp tone="red">{featuredTonight ? "Tonight" : "Coming up"}</Stamp><span className="mono">{formatDay(featured.startsAt)} · {formatClock(featured.startsAt)}</span></div>
          <div className="tonight-body">
            <Still movie={featured} />
            <h1 id="tonight-title">{featured.title}</h1>
            {featured.synopsis && <p className="blurb">{featured.synopsis}</p>}
            <dl className="facts">
              <div><dt>Where</dt><dd>{featured.theatre.name}</dd></div>
              <div><dt>When</dt><dd>{formatDay(featured.startsAt)}, {formatClock(featured.startsAt)}</dd></div>
              {featured.year && <div><dt>Year</dt><dd>{featured.year}</dd></div>}
            </dl>
            <a className="cta" href={featured.ticketUrl} target="_blank" rel="noreferrer">
              {featured.status === "sold_out" ? "Sold out" : `Buy tickets at ${featured.theatre.name}`}
            </a>
          </div>
        </> : <>
          <div className="tonight-label"><Stamp>Vancouver</Stamp></div>
          <h1 id="tonight-title">No films found</h1>
          <p className="blurb">{searching ? "Nothing matches your search." : "No upcoming screenings."}</p>
        </>}
      </section>

      <section className="listings" id="showtimes">
        <h2 className="rule-heading"><span>Now showing</span><small>{movies.length} {movies.length === 1 ? "film" : "films"}</small></h2>
        <div className="filters" role="group" aria-label="Filter by cinema">
          <span className="mono">Cinema:</span>
          <button type="button" className={venue === "all" ? "textlink current" : "textlink"} aria-pressed={venue === "all"} onClick={() => setVenue("all")}>All</button>
          {theatres.map((item) => <button type="button" key={item.slug} className={venue === item.slug ? "textlink current" : "textlink"} aria-pressed={venue === item.slug} onClick={() => setVenue(item.slug)}>{item.name}</button>)}
        </div>
        {demo && <p className="notice"><b>Sample listings.</b> Set DATABASE_URL to show the live schedule.</p>}
        {movies.length > 0 ? <div className="flyers">{movies.map((movie) => {
          const isSaved = isSavedId(movie.movieId);
          return <article className="flyer" key={movie.movieId}>
            <div className="flyer-poster"><Poster movie={movie} />{movie.tags[0] && <Stamp>{movie.tags[0]}</Stamp>}</div>
            <h3>{movie.title}</h3>
            <p className="flyer-meta">{movie.year ? `${movie.year} · ` : ""}{movie.theatre.name}</p>
            <button type="button" className="textlink" aria-pressed={isSaved} aria-label={isSaved ? `Remove ${movie.title} from saved` : `Save ${movie.title} `} onClick={() => toggle(movie)}>{isSaved ? "[ saved ]" : "[ save ]"}</button>
          </article>;
        })}</div> : <p className="empty">No films match.</p>}

        <h2 className="rule-heading"><span>Showtimes</span><small>{visible.length} {visible.length === 1 ? "screening" : "screenings"}</small></h2>
        {visible.length > 0 ? <ol className="rows">{visible.map((item) => <li className="row" key={item.id}>
          <div className="row-when"><b>{formatClock(item.startsAt)}</b><span>{formatDay(item.startsAt)}</span></div>
          <div className="row-what">
            <h3>{item.title}</h3>
            <p>{item.theatre.name}{item.status === "sold_out" && <Stamp tone="red">Sold out</Stamp>}{item.tags[0] && <Stamp>{item.tags[0]}</Stamp>}</p>
          </div>
          <a className="textlink" href={item.ticketUrl} target="_blank" rel="noreferrer" aria-label={`Tickets for ${item.title} at ${item.theatre.name}`}>[ tickets ]</a>
        </li>)}</ol> : <p className="empty">No showtimes for this selection.</p>}
      </section>

      <section className="watchlist" id="saved">
        <h2 className="rule-heading"><span>Saved</span><small>{saved.length} saved</small></h2>
        {savedRows.length > 0 ? <ol className="rows">{savedRows.map(({ film, next }) => <li className="row" key={film.movieId}>
          {next
            ? <div className="row-when"><b>{formatClock(next.startsAt)}</b><span>{formatDay(next.startsAt)}</span></div>
            : <div className="row-when"><span>No upcoming screenings</span></div>}
          <div className="row-what"><h3>{film.title}</h3><p>{next ? next.theatre.name : film.theatre}</p></div>
          <button type="button" className="textlink" aria-label={`Remove ${film.title} from saved`} onClick={() => setSaved((current) => { const value = toggleSaved(current, film); writeSaved(value); return value; })}>[ remove ]</button>
        </li>)}</ol> : <p className="empty">Nothing saved. Saved films are kept in this browser.</p>}
      </section>
    </main>

    <footer className="colophon">
      <p>Tickets are sold by each cinema. Listings updated {formatDay(generatedAt)}, {formatClock(generatedAt)}.</p>
      <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
    </footer>
  </div>;
}
