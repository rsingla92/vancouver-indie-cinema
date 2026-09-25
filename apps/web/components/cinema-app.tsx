"use client";
import { useMemo, useState } from "react";
import { Colophon } from "./colophon";
import { FilmGrid } from "./film-grid";
import { Masthead, type NavTab } from "./masthead";
import { SavedFilms } from "./saved-films";
import { ShowtimeList } from "./showtime-list";
import { Tonight } from "./tonight";
import { useCity } from "@/hooks/use-city";
import { useNow } from "@/hooks/use-now";
import { useSavedFilms } from "@/hooks/use-saved-films";
import { VANCOUVER_TZ } from "@/lib/format";
import { citiesOf, firstShowtimePerMovie, matchesQuery, theatresOf, upcoming } from "@/lib/showtimes";
import type { ShowtimeView } from "@/lib/types";

interface CinemaAppProps {
  /** Every active showtime in the build, sorted by start time. */
  initialShowtimes: ShowtimeView[];
  demo: boolean;
  /** When the listing was built; the page starts from this clock so server and client agree. */
  generatedAt: string;
}

export function CinemaApp({ initialShowtimes, demo, generatedAt }: CinemaAppProps) {
  const now = useNow(generatedAt);
  const cities = useMemo(() => citiesOf(initialShowtimes), [initialShowtimes]);
  const [city, setCity] = useCity(cities);
  const [venue, setVenue] = useState("all");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<NavTab>("tonight");
  const { saved, isSaved, toggle } = useSavedFilms(initialShowtimes);

  const live = useMemo(() => upcoming(initialShowtimes, now), [initialShowtimes, now]);
  const inCity = useMemo(() => live.filter((item) => item.theatre.city === city), [live, city]);
  const theatres = useMemo(() => theatresOf(inCity), [inCity]);
  const activeVenue = theatres.some((theatre) => theatre.slug === venue) ? venue : "all";
  const visible = useMemo(
    () => inCity.filter((item) => (activeVenue === "all" || item.theatre.slug === activeVenue) && matchesQuery(item, query)),
    [inCity, activeVenue, query],
  );
  const films = useMemo(() => firstShowtimePerMovie(visible), [visible]);
  const nextShowtime = useMemo(() => new Map(firstShowtimePerMovie(live).map((item) => [item.movieId, item])), [live]);
  const timezone = inCity[0]?.theatre.timezone ?? VANCOUVER_TZ;

  return <div className="zine">
    <Masthead
      city={city} cities={cities} onCityChange={setCity} theatres={theatres}
      now={now} generatedAt={generatedAt} timezone={timezone}
      tab={tab} onTabChange={setTab} query={query} onQueryChange={setQuery}
    />
    <main>
      <Tonight film={films[0]} now={now} timezone={timezone} searching={query.trim().length > 0} />
      <section className="listings" id="showtimes">
        <FilmGrid films={films} theatres={theatres} venue={activeVenue} onVenueChange={setVenue} demo={demo} isSaved={isSaved} onToggleSaved={toggle} />
        <ShowtimeList showtimes={visible} timezone={timezone} />
      </section>
      <SavedFilms saved={saved} nextShowtime={nextShowtime} timezone={timezone} onRemove={toggle} />
    </main>
    <Colophon generatedAt={generatedAt} timezone={timezone} />
  </div>;
}
