import { ShowtimeRow } from "./showtime-row";
import type { SavedFilm } from "@/lib/saved";
import type { ShowtimeView } from "@/lib/types";

interface SavedFilmsProps {
  saved: SavedFilm[];
  /** Next screening per film id, for the films that still have one. */
  nextShowtime: Map<string, ShowtimeView>;
  timezone: string;
  onRemove: (film: SavedFilm) => void;
}

/** The viewer's watchlist, kept in this browser. Films stay listed after their run ends. */
export function SavedFilms({ saved, nextShowtime, timezone, onRemove }: SavedFilmsProps) {
  return <section className="watchlist" id="saved">
    <h2 className="rule-heading"><span>Saved</span><small>{saved.length} saved</small></h2>
    {saved.length === 0
      ? <p className="empty">Nothing saved. Saved films are kept in this browser.</p>
      : <ol className="rows">{saved.map((film) => {
        const next = nextShowtime.get(film.movieId) ?? null;
        return <ShowtimeRow
          key={film.movieId}
          startsAt={next?.startsAt ?? null}
          timezone={next?.theatre.timezone ?? timezone}
          title={film.title}
          detail={next ? next.theatre.name : film.theatre}
          action={<button type="button" className="textlink" aria-label={`Remove ${film.title} from saved`} onClick={() => onRemove(film)}>[ remove ]</button>}
        />;
      })}</ol>}
  </section>;
}
