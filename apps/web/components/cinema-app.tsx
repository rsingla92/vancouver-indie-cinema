"use client";
import { CalendarDays, Clapperboard, Heart, MapPin, Search, Ticket, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import type { ShowtimeView } from "@/lib/types";

const formatTime = (value: string) => new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit", timeZone: "America/Vancouver" }).format(new Date(value));
const formatDay = (value: string) => new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Vancouver" }).format(new Date(value));

export function CinemaApp({ initialShowtimes, demo }: { initialShowtimes: ShowtimeView[]; demo: boolean }) {
  const [venue, setVenue] = useState("all");
  const [saved, setSaved] = useState<string[]>([]);
  const theatres = useMemo(() => Array.from(new Map(initialShowtimes.map((item) => [item.theatre.slug, item.theatre])).values()), [initialShowtimes]);
  const movies = useMemo(() => Array.from(new Map(initialShowtimes.filter((item) => venue === "all" || item.theatre.slug === venue).map((item) => [item.movieId, item])).values()), [initialShowtimes, venue]);
  const featured = movies[0];

  return <main>
    <header className="topbar"><a className="brand" href="#top" aria-label="IndieScreen home"><span>INDIE</span>SCREEN</a><button className="icon-button" aria-label="Search"><Search size={21}/></button></header>
    {featured && <section className="hero" style={{ backgroundImage: featured.backdropUrl ? `linear-gradient(180deg,rgba(7,8,10,.08),#07080a 94%),url(${featured.backdropUrl})` : undefined }}>
      <div className="eyebrow">TONIGHT IN VANCOUVER</div><h1>{featured.title}</h1><p>{featured.synopsis}</p>
      <div className="hero-meta"><span>{featured.year}</span><span>•</span><span>{featured.theatre.name}</span></div>
      <a className="primary-button" href={featured.ticketUrl} target="_blank" rel="noreferrer"><Ticket size={18}/>Get Tickets</a>
    </section>}
    <section className="content" id="showtimes">
      <div className="section-heading"><div><span className="eyebrow">CURATED LOCALLY</span><h2>Now showing</h2></div><span className="count">{movies.length} films</span></div>
      <div className="filters" aria-label="Filter by theatre"><button className={venue === "all" ? "active" : ""} onClick={() => setVenue("all")}>All cinemas</button>{theatres.map((item) => <button key={item.slug} className={venue === item.slug ? "active" : ""} onClick={() => setVenue(item.slug)}>{item.name}</button>)}</div>
      {demo && <div className="demo-note">Preview schedule · connect Supabase to display live listings</div>}
      <div className="poster-rail">{movies.map((movie) => <article className="movie-card" key={movie.movieId}>
        <div className="poster-wrap"><img src={movie.posterUrl} alt={`${movie.title} poster`}/><button className={saved.includes(movie.movieId) ? "save saved" : "save"} aria-label={`Save ${movie.title}`} onClick={() => setSaved((current) => current.includes(movie.movieId) ? current.filter((id) => id !== movie.movieId) : [...current, movie.movieId])}><Heart size={18} fill="currentColor"/></button>{movie.tags[0] && <span className="tag">{movie.tags[0]}</span>}</div>
        <h3>{movie.title}</h3><p>{movie.year} · {movie.theatre.name}</p>
      </article>)}</div>
      <div className="section-heading schedule-title"><div><span className="eyebrow">PLAN YOUR NIGHT</span><h2>Upcoming showtimes</h2></div><CalendarDays size={22}/></div>
      <div className="schedule">{initialShowtimes.filter((item) => venue === "all" || item.theatre.slug === venue).map((item) => <article className="showtime-row" key={item.id}>
        <div className="date-block"><strong>{formatTime(item.startsAt)}</strong><span>{formatDay(item.startsAt)}</span></div><div className="showtime-info"><h3>{item.title}</h3><span><MapPin size={14}/>{item.theatre.name}</span></div><a href={item.ticketUrl} target="_blank" rel="noreferrer" aria-label={`Tickets for ${item.title}`}><Ticket size={18}/></a>
      </article>)}</div>
    </section>
    <nav className="bottom-nav" aria-label="Primary navigation"><a className="selected" href="#top"><Clapperboard/><span>Discover</span></a><a href="#showtimes"><CalendarDays/><span>Schedule</span></a><a href="#saved"><Heart/><span>Saved</span></a><a href="#profile"><UserRound/><span>Profile</span></a></nav>
  </main>;
}
