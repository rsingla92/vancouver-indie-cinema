import { Poster } from "./poster";
import { Stamp } from "./stamp";
import type { SavedFilm } from "@/lib/saved";
import type { ShowtimeView, TheatreRef } from "@/lib/types";

interface FilmGridProps {
  films: ShowtimeView[];
  theatres: TheatreRef[];
  venue: string;
  onVenueChange: (slug: string) => void;
  demo: boolean;
  isSaved: (movieId: string) => boolean;
  onToggleSaved: (film: SavedFilm) => void;
}

/** "Now showing": one flyer per film, with the cinema filter above it. */
export function FilmGrid({ films, theatres, venue, onVenueChange, demo, isSaved, onToggleSaved }: FilmGridProps) {
  return <>
    <h2 className="rule-heading"><span>Now showing</span><small>{films.length} {films.length === 1 ? "film" : "films"}</small></h2>
    <div className="filters" role="group" aria-label="Filter by cinema">
      <span className="mono">Cinema:</span>
      <button type="button" className={venue === "all" ? "textlink current" : "textlink"} aria-pressed={venue === "all"} onClick={() => onVenueChange("all")}>All</button>
      {theatres.map((theatre) => <button type="button" key={theatre.slug} className={venue === theatre.slug ? "textlink current" : "textlink"} aria-pressed={venue === theatre.slug} onClick={() => onVenueChange(theatre.slug)}>{theatre.name}</button>)}
    </div>
    {demo && <p className="notice"><b>Sample listings.</b> Set DATABASE_URL to show the live schedule.</p>}
    {films.length === 0
      ? <p className="empty">No films match.</p>
      : <div className="flyers">{films.map((film) => {
        const saved = isSaved(film.movieId);
        return <article className="flyer" key={film.movieId}>
          <div className="flyer-poster"><Poster movie={film} />{film.tags[0] && <Stamp>{film.tags[0]}</Stamp>}</div>
          <h3>{film.title}</h3>
          <p className="flyer-meta">{film.year ? `${film.year} · ` : ""}{film.theatre.name}</p>
          <button type="button" className="textlink" aria-pressed={saved} aria-label={saved ? `Remove ${film.title} from saved` : `Save ${film.title}`} onClick={() => onToggleSaved({ movieId: film.movieId, title: film.title, theatre: film.theatre.name })}>{saved ? "[ saved ]" : "[ save ]"}</button>
        </article>;
      })}</div>}
  </>;
}
