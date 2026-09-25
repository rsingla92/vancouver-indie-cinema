import { ShowtimeRow } from "./showtime-row";
import { Stamp } from "./stamp";
import type { ShowtimeView } from "@/lib/types";

/** "Showtimes": every upcoming screening that matches the current filters. */
export function ShowtimeList({ showtimes, timezone, range }: { showtimes: ShowtimeView[]; timezone: string; range: string }) {
  return <>
    <h2 className="rule-heading" id="showtimes"><span>Showtimes</span><small>{showtimes.length} {showtimes.length === 1 ? "screening" : "screenings"} · {range.toLowerCase()}</small></h2>
    {showtimes.length === 0
      ? <p className="empty">No showtimes in this range.</p>
      : <ol className="rows">{showtimes.map((item) => <ShowtimeRow
        key={item.id}
        startsAt={item.startsAt}
        timezone={timezone}
        title={item.title}
        detail={<>{item.theatre.name}{item.status === "sold_out" && <Stamp tone="red">Sold out</Stamp>}{item.tags[0] && <Stamp>{item.tags[0]}</Stamp>}</>}
        action={<a className="textlink" href={item.ticketUrl} target="_blank" rel="noreferrer" aria-label={`Tickets for ${item.title} at ${item.theatre.name}`}>[ tickets ]</a>}
      />)}</ol>}
  </>;
}
