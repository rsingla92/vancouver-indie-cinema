"use client";
import { useMemo, useState } from "react";
import { Colophon } from "./colophon";
import { Listings } from "./listings";
import { Masthead } from "./masthead";
import { Pick } from "./pick";
import { useCity } from "@/hooks/use-city";
import { useNow } from "@/hooks/use-now";
import { VANCOUVER_TZ } from "@/lib/format";
import { citiesOf, DEFAULT_WINDOW, firstShowtimePerMovie, inWindow, listingsOf, matchesQuery, theatresOf, upcoming, windowsOf } from "@/lib/showtimes";
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
  const [when, setWhen] = useState(DEFAULT_WINDOW);
  const [query, setQuery] = useState("");
  const [pick, setPick] = useState(pickSeed);

  const live = useMemo(() => upcoming(initialShowtimes, now), [initialShowtimes, now]);
  const inCity = useMemo(() => live.filter((item) => item.theatre.city === city), [live, city]);
  const theatres = useMemo(() => theatresOf(inCity), [inCity]);
  const activeVenue = theatres.some((theatre) => theatre.slug === venue) ? venue : "all";
  const timezone = inCity[0]?.theatre.timezone ?? VANCOUVER_TZ;
  const windows = useMemo(() => windowsOf(inCity, timezone), [inCity, timezone]);
  const activeWindow = windows.some((window) => window.id === when) ? when : DEFAULT_WINDOW;
  const visible = useMemo(
    () => inCity.filter((item) =>
      (activeVenue === "all" || item.theatre.slug === activeVenue) && inWindow(item, activeWindow, now, timezone) && matchesQuery(item, query)),
    [inCity, activeVenue, activeWindow, now, timezone, query],
  );
  const films = useMemo(() => firstShowtimePerMovie(visible), [visible]);
  const listings = useMemo(() => listingsOf(visible, timezone), [visible, timezone]);
  const featured = films.length > 0 ? films[pick % films.length] : undefined;
  const pickAnother = () => setPick((current) => {
    let next = current;
    while (films.length > 1 && next % films.length === current % films.length) next = Math.floor(Math.random() * 1_000_000);
    return next;
  });

  return <div className="zine">
    <Masthead
      city={city} cities={cities} onCityChange={setCity} theatres={theatres}
      now={now} generatedAt={generatedAt} timezone={timezone}
      query={query} onQueryChange={setQuery}
    />
    <main>
      <Pick film={featured} city={city} now={now} timezone={timezone} searching={query.trim().length > 0} {...(films.length > 1 ? { onPickAnother: pickAnother } : {})} />
      <Listings
        listings={listings} theatres={theatres} venue={activeVenue} onVenueChange={setVenue}
        windows={windows} when={activeWindow} onWhenChange={setWhen} timezone={timezone} demo={demo}
      />
    </main>
    <Colophon generatedAt={generatedAt} timezone={timezone} />
  </div>;
}
