import postgres from "postgres";
import { demoShowtimes } from "./demo-data";
import type { ShowtimeView } from "./types";

export async function getShowtimes(days = 7): Promise<{ data: ShowtimeView[]; demo: boolean }> {
  if (!process.env.DATABASE_URL) return { data: demoShowtimes, demo: true };
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    const rows = await sql<ShowtimeView[]>`
      select s.id::text, m.id::text as "movieId", m.title, m.release_year as year,
        coalesce(m.synopsis, '') as synopsis,
        case when m.poster_path is null then '' else 'https://image.tmdb.org/t/p/w500' || m.poster_path end as "posterUrl",
        case when m.backdrop_path is null then '' else 'https://image.tmdb.org/t/p/w1280' || m.backdrop_path end as "backdropUrl",
        json_build_object('slug', t.slug, 'name', t.name) as theatre,
        s.starts_at::text as "startsAt", s.ticket_url as "ticketUrl", s.status,
        coalesce(array_agg(tag.label) filter (where tag.id is not null), '{}') as tags
      from showtimes s join movies m on m.id = s.movie_id join theatres t on t.id = s.theatre_id
      left join showtime_tags st on st.showtime_id = s.id left join tags tag on tag.id = st.tag_id
      where s.is_active and s.status in ('scheduled', 'sold_out') and s.starts_at >= now()
        and s.starts_at < now() + (${days} || ' days')::interval
      group by s.id, m.id, t.id order by s.starts_at asc`;
    return { data: rows, demo: false };
  } finally { await sql.end(); }
}
