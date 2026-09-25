import { formatClock, formatDay } from "@/lib/format";

export function Colophon({ generatedAt, timezone }: { generatedAt: string; timezone: string }) {
  return <footer className="colophon">
    <p>Tickets are sold by each cinema. Listings updated {formatDay(generatedAt, timezone)}, {formatClock(generatedAt, timezone)}.</p>
    <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
  </footer>;
}
