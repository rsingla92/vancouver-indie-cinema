import type { ReactNode } from "react";
import { formatClock, formatDay } from "@/lib/format";

interface ShowtimeRowProps {
  /** ISO start time, or null when nothing is scheduled. */
  startsAt: string | null;
  timezone: string;
  title: string;
  detail: ReactNode;
  action: ReactNode;
}

/** One line of the schedule: time on the left, film in the middle, a text link on the right. */
export function ShowtimeRow({ startsAt, timezone, title, detail, action }: ShowtimeRowProps) {
  return <li className="row">
    <div className="row-when">
      {startsAt ? <><b>{formatClock(startsAt, timezone)}</b><span>{formatDay(startsAt, timezone)}</span></> : <span>No upcoming screenings</span>}
    </div>
    <div className="row-what"><h3>{title}</h3><p>{detail}</p></div>
    {action}
  </li>;
}
