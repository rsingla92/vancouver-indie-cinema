import { formatClock, formatLongDay } from "@/lib/format";
import { SITE_DESCRIPTION } from "@/lib/site";
import type { TheatreRef } from "@/lib/types";

type NavTab = "tonight" | "showtimes" | "saved";
const NAV: ReadonlyArray<{ id: NavTab; href: string; label: string }> = [
  { id: "tonight", href: "#tonight", label: "Now playing" },
  { id: "showtimes", href: "#showtimes", label: "Schedule" },
  { id: "saved", href: "#saved", label: "Saved" },
];

interface MastheadProps {
  city: string;
  cities: string[];
  onCityChange: (city: string) => void;
  theatres: TheatreRef[];
  now: Date;
  generatedAt: string;
  timezone: string;
  tab: NavTab;
  onTabChange: (tab: NavTab) => void;
  query: string;
  onQueryChange: (query: string) => void;
}

export type { NavTab };

export function Masthead({ city, cities, onCityChange, theatres, now, generatedAt, timezone, tab, onTabChange, query, onQueryChange }: MastheadProps) {
  return <header className="masthead">
    <div className="dateline">
      {cities.length > 1
        ? <label className="city-select">City <select value={city} onChange={(event) => onCityChange(event.target.value)}>{cities.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        : <span>{city}</span>}
      <span>{formatLongDay(now, timezone)}</span>
      <span>Updated {formatClock(generatedAt, timezone)}</span>
    </div>
    <a className="brand" href="#top" aria-label="Double Bill home">Double<span>Bill</span></a>
    <p className="tagline">{theatres.length > 0 ? theatres.map((theatre) => theatre.name).join(" · ") : SITE_DESCRIPTION}</p>
    <nav className="menu" aria-label="Primary navigation">
      {NAV.map(({ id, href, label }) => <a key={id} href={href} className={tab === id ? "current" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => onTabChange(id)}>[ {label} ]</a>)}
    </nav>
    <form className="searchbox" role="search" onSubmit={(event) => event.preventDefault()}>
      <label htmlFor="film-search">Search</label>
      <div className="searchbox-row">
        <input id="film-search" type="search" value={query} placeholder="Film or cinema" onChange={(event) => onQueryChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") onQueryChange(""); }} />
        {query.trim() && <button type="button" className="textlink" onClick={() => onQueryChange("")}>clear</button>}
      </div>
    </form>
  </header>;
}
