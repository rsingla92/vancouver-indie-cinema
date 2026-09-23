"use client";
import { CalendarDays, Clapperboard, Heart, MapPin, Search, Ticket, X, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { firstShowtimePerMovie, matchesQuery } from "@/lib/showtimes";
import type { ShowtimeView } from "@/lib/types";

const TIMEZONE = "America/Vancouver";
const SAVED_KEY = "indiescreen:saved";

const timeFormat = new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit", timeZone: TIMEZONE });
const dayFormat = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: TIMEZONE });
const dateKeyFormat = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TIMEZONE });
const formatTime = (value: string) => timeFormat.format(new Date(value));
const formatDay = (value: string) => dayFormat.format(new Date(value));
const dateKey = (value: string) => dateKeyFormat.format(new Date(value));

type NavTab = "discover" | "schedule" | "saved";
const NAV: ReadonlyArray<{ id: NavTab; href: string; label: string; Icon: LucideIcon }> = [
  { id: "discover", href: "#top", label: "Discover", Icon: Clapperboard },
  { id: "schedule", href: "#showtimes", label: "Schedule", Icon: CalendarDays },
  { id: "saved", href: "#saved", label: "Saved", Icon: Heart },
];

function readSaved(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function writeSaved(ids: string[]) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(ids));
  } catch {
    // Storage may be unavailable (private mode, quota); saving is best-effort.
  }
}

function Poster({ movie }: { movie: ShowtimeView }) {
  const [failed, setFailed] = useState(false);
  if (!movie.posterUrl || failed) {
    return <div className="poster-fallback" aria-hidden="true"><span>{movie.title}</span></div>;
  }
  return <img src={movie.posterUrl} alt={`${movie.title} poster`} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [tab, setTab] = useState<NavTab>("discover");

  useEffect(() => { setSaved(readSaved()); }, []);

  const toggleSaved = (movieId: string) => setSaved((current) => {
    const next = current.includes(movieId) ? current.filter((id) => id !== movieId) : [...current, movieId];
    writeSaved(next);
    return next;
  });

  const closeSearch = () => { setSearchOpen(false); setQuery(""); };

  const theatres = useMemo(() => Array.from(new Map(initialShowtimes.map((item) => [item.theatre.slug, item.theatre])).values()), [initialShowtimes]);
  const searching = query.trim().length > 0;
  const visible = useMemo(() => initialShowtimes.filter((item) => (venue === "all" || item.theatre.slug === venue) && matchesQuery(item, query)), [initialShowtimes, venue, query]);
  const movies = useMemo(() => firstShowtimePerMovie(visible), [visible]);
  const savedMovies = useMemo(() => firstShowtimePerMovie(initialShowtimes.filter((item) => saved.includes(item.movieId))), [initialShowtimes, saved]);

  const featured = movies[0];
  const featuredTonight = featured ? dateKey(featured.startsAt) === dateKey(generatedAt) : false;
  const heroStyle = featured?.backdropUrl ? { backgroundImage: `linear-gradient(180deg,rgba(7,8,10,.08),#07080a 94%),url(${featured.backdropUrl})` } : undefined;

  return <main>
    <header className="topbar">
      <a className="brand" href="#top" aria-label="IndieScreen home"><span>INDIE</span>SCREEN</a>
      <button className="icon-button" type="button" aria-label={searchOpen ? "Close search" : "Search films"} aria-expanded={searchOpen} aria-controls="search" onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}>
        {searchOpen ? <X size={21} /> : <Search size={21} />}
      </button>
    </header>
    {searchOpen && <div className="search-bar" id="search" role="search">
      <input type="search" autoFocus placeholder="Search films or cinemas" aria-label="Search films or cinemas" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") closeSearch(); }} />
    </div>}

    {featured ? <section className="hero" style={heroStyle}>
      <div className="eyebrow">{featuredTonight ? "TONIGHT IN VANCOUVER" : "COMING UP IN VANCOUVER"}</div>
      <h1>{featured.title}</h1>
      {featured.synopsis && <p>{featured.synopsis}</p>}
      <div className="hero-meta">
        {featured.year && <span>{featured.year}</span>}
        <span>{featured.theatre.name}</span>
        <span>{formatDay(featured.startsAt)}, {formatTime(featured.startsAt)}</span>
      </div>
      <a className="primary-button" href={featured.ticketUrl} target="_blank" rel="noreferrer"><Ticket size={18} />{featured.status === "sold_out" ? "Sold out · Check venue" : "Get Tickets"}</a>
    </section> : <section className="hero">
      <div className="eyebrow">VANCOUVER</div>
      <h1>Nothing on the marquee</h1>
      <p>{searching ? "No films match your search." : "No upcoming screenings were found. Check back soon."}</p>
    </section>}

    <section className="content" id="showtimes">
      <div className="section-heading"><div><span className="eyebrow">CURATED LOCALLY</span><h2>Now showing</h2></div><span className="count">{movies.length} {movies.length === 1 ? "film" : "films"}</span></div>
      <div className="filters" role="group" aria-label="Filter by cinema">
        <button type="button" className={venue === "all" ? "active" : ""} aria-pressed={venue === "all"} onClick={() => setVenue("all")}>All cinemas</button>
        {theatres.map((item) => <button type="button" key={item.slug} className={venue === item.slug ? "active" : ""} aria-pressed={venue === item.slug} onClick={() => setVenue(item.slug)}>{item.name}</button>)}
      </div>
      {demo && <div className="demo-note">Preview schedule · connect a database to display live listings</div>}
      {movies.length > 0 ? <div className="poster-rail">{movies.map((movie) => {
        const isSaved = saved.includes(movie.movieId);
        return <article className="movie-card" key={movie.movieId}>
          <div className="poster-wrap">
            <Poster movie={movie} />
            <button type="button" className={isSaved ? "save saved" : "save"} aria-label={isSaved ? `Remove ${movie.title} from saved` : `Save ${movie.title}`} aria-pressed={isSaved} onClick={() => toggleSaved(movie.movieId)}><Heart size={18} fill="currentColor" /></button>
            {movie.tags[0] && <span className="tag">{movie.tags[0]}</span>}
          </div>
          <h3>{movie.title}</h3><p>{movie.year ? `${movie.year} · ` : ""}{movie.theatre.name}</p>
        </article>;
      })}</div> : <p className="empty-state">No films match. Try another cinema or clear your search.</p>}

      <div className="section-heading schedule-title"><div><span className="eyebrow">PLAN YOUR NIGHT</span><h2>Upcoming showtimes</h2></div><span className="updated" title={`Listings refreshed ${formatDay(generatedAt)}, ${formatTime(generatedAt)}`}>Updated {formatTime(generatedAt)}</span></div>
      {visible.length > 0 ? <div className="schedule">{visible.map((item) => <article className="showtime-row" key={item.id}>
        <div className="date-block"><strong>{formatTime(item.startsAt)}</strong><span>{formatDay(item.startsAt)}</span></div>
        <div className="showtime-info">
          <h3>{item.title}</h3>
          <span><MapPin size={14} />{item.theatre.name}{item.status === "sold_out" && <em className="sold-out">Sold out</em>}{item.tags[0] && <em className="row-tag">{item.tags[0]}</em>}</span>
        </div>
        <a href={item.ticketUrl} target="_blank" rel="noreferrer" aria-label={`Tickets for ${item.title} at ${item.theatre.name}`}><Ticket size={18} /></a>
      </article>)}</div> : <p className="empty-state">No showtimes to show for this selection.</p>}
    </section>

    <section className="content saved" id="saved">
      <div className="section-heading"><div><span className="eyebrow">YOUR WATCHLIST</span><h2>Saved films</h2></div><span className="count">{savedMovies.length} saved</span></div>
      {savedMovies.length > 0 ? <div className="schedule">{savedMovies.map((movie) => <article className="showtime-row" key={movie.movieId}>
        <div className="date-block"><strong>{formatTime(movie.startsAt)}</strong><span>{formatDay(movie.startsAt)}</span></div>
        <div className="showtime-info"><h3>{movie.title}</h3><span><MapPin size={14} />{movie.theatre.name}</span></div>
        <button type="button" className="row-action" aria-label={`Remove ${movie.title} from saved`} onClick={() => toggleSaved(movie.movieId)}><X size={18} /></button>
      </article>)}</div> : <p className="empty-state">Tap the heart on a poster to keep films you want to see. Your list stays on this device.</p>}
    </section>

    <nav className="bottom-nav" aria-label="Primary navigation">
      {NAV.map(({ id, href, label, Icon }) => <a key={id} href={href} className={tab === id ? "selected" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}><Icon /><span>{label}</span></a>)}
    </nav>
  </main>;
}
