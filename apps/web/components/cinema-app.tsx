"use client";
import { useMemo, useState } from "react";
import { Colophon } from "./colophon";
import { FilmGrid } from "./film-grid";
import { Masthead, type NavTab } from "./masthead";
import { ShowtimeList } from "./showtime-list";
import { Tonight } from "./tonight";
import { useCity } from "@/hooks/use-city";
import { useNow } from "@/hooks/use-now";
import { VANCOUVER_TZ } from "@/lib/format";
import { citiesOf, firstShowtimePerMovie, matchesQuery, theatresOf, upcoming } from "@/lib/showtimes";
import type { ShowtimeView } from "@/lib/types";

interface CinemaAppProps {
  /** Every active showtime in the build, sorted by start time. */
  initialShowtimes: ShowtimeView[];
  demo: boolean;
  /** When the listing was built; the page starts from this clock so server and client agree. */
  generatedAt: string;
  /** Seed for the featured pick, chosen at build time for the same reason. */
  pickSeed: number;
}

export function CinemaApp({ initialShowtimes, demo, generatedAt, pickSeed }: CinemaAppProps) {
  const now = useNow(generatedAt);
  const cities = useMemo(() => citiesOf(initialShowtimes), [initialShowtimes]);
  const [city, setCity] = useCity(cities);
  const [venue, setVenue] = useState("all");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<NavTab>("tonight");
  const [pick, setPick] = useState(pickSeed);

  const live = useMemo(() => upcoming(initialShowtimes, now), [initialShowtimes, now]);
  const inCity = useMemo(() => live.filter((item) => item.theatre.city === city), [live, city]);
  const theatres = useMemo(() => theatresOf(inCity), [inCity]);
  const activeVenue = theatres.some((theatre) => theatre.slug === venue) ? venue : "all";
  const visible = useMemo(
    () => inCity.filter((item) => (activeVenue === "all" || item.theatre.slug === activeVenue) && matchesQuery(item, query)),
    [inCity, activeVenue, query],
  );
  const films = useMemo(() => firstShowtimePerMovie(visible), [visible]);
  const featured = films.length > 0 ? films[pick % films.length] : undefined;
  const pickAnother = () => setPick((current) => {
    let next = current;
    while (films.length > 1 && next % films.length === current % films.length) next = Math.floor(Math.random() * 1_000_000);
    return next;
  });
  const timezone = inCity[0]?.theatre.timezone ?? VANCOUVER_TZ;

  return <div className="zine">
    <Masthead
      city={city} cities={cities} onCityChange={setCity} theatres={theatres}
      now={now} generatedAt={generatedAt} timezone={timezone}
      tab={tab} onTabChange={setTab} query={query} onQueryChange={setQuery}
    />
    <main>
      <Tonight film={featured} city={city} now={now} timezone={timezone} searching={query.trim().length > 0} {...(films.length > 1 ? { onPickAnother: pickAnother } : {})} />
      <section className="listings" id="showtimes">
        <FilmGrid films={films} theatres={theatres} venue={activeVenue} onVenueChange={setVenue} demo={demo} />
        <ShowtimeList showtimes={visible} timezone={timezone} />
      </section>
    </main>
    <Colophon generatedAt={generatedAt} timezone={timezone} />
  </div>;
}
