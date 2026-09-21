import postgres from "postgres";
import type { ExtractedShowtime } from "../contracts.js";
import type { NormalizedTitle, RankedCandidate } from "./contracts.js";

export interface MergeInput {
  item: ExtractedShowtime;
  normalized: NormalizedTitle;
  candidate: RankedCandidate | null;
  payloadHash: string;
  model: string;
}

export class CinemaRepository {
  private readonly sql: ReturnType<typeof postgres>;

  constructor(databaseUrl = process.env.DATABASE_URL) {
    if (!databaseUrl) throw new Error("DATABASE_URL is required");
    this.sql = postgres(databaseUrl, { max: 4 });
  }

  async merge(input: MergeInput): Promise<{ status: "matched" | "review"; movieId?: string }> {
    return this.sql.begin(async (sql) => {
      const theatres = await sql<{ id: string }[]>`select id from theatres where slug = ${input.item.venueSlug}`;
      const theatre = theatres[0];
      if (!theatre) throw new Error(`Unknown theatre: ${input.item.venueSlug}`);
      const status = input.candidate ? "matched" : "review";
      const rawRows = await sql<{ id: string }[]>`
        insert into raw_source_items (theatre_id, source_uid, raw_title, source_url, payload, payload_hash,
          normalized_title, normalized_year, normalization_confidence, normalization_model,
          normalization_prompt_version, normalization_output, normalization_status, tmdb_candidate_id,
          match_confidence, match_reason, resolved_at)
        values (${theatre.id}, ${input.item.sourceUid}, ${input.item.rawTitle}, ${input.item.detailUrl},
          ${sql.json(JSON.parse(JSON.stringify(input.item.sourcePayload)))}, ${input.payloadHash}, ${input.normalized.coreTitle},
          ${input.normalized.releaseYear}, ${input.normalized.confidence}, ${input.model}, 'title-v1',
          ${sql.json(input.normalized)}, ${status}, ${input.candidate?.movie.id ?? null},
          ${input.candidate?.score ?? null}, ${input.candidate?.reason ?? 'No candidate cleared the confidence and ambiguity thresholds'},
          ${input.candidate ? sql`now()` : null})
        on conflict (theatre_id, source_uid, payload_hash) do update set
          fetched_at = now(), normalized_title = excluded.normalized_title,
          normalized_year = excluded.normalized_year, normalization_status = excluded.normalization_status,
          normalization_output = excluded.normalization_output, tmdb_candidate_id = excluded.tmdb_candidate_id,
          match_confidence = excluded.match_confidence, match_reason = excluded.match_reason,
          resolved_at = excluded.resolved_at
        returning id`;
      const raw = rawRows[0]!;
      if (!input.candidate) return { status: "review" as const };

      const movie = input.candidate.movie;
      const releaseYear = movie.release_date ? Number(movie.release_date.slice(0, 4)) : input.normalized.releaseYear;
      const movieRows = await sql<{ id: string }[]>`
        insert into movies (tmdb_id, title, original_title, release_year, synopsis, poster_path, backdrop_path, metadata, tmdb_last_synced_at)
        values (${movie.id}, ${movie.title}, ${movie.original_title}, ${releaseYear}, ${movie.overview},
          ${movie.poster_path}, ${movie.backdrop_path}, ${sql.json({ genreIds: movie.genre_ids, popularity: movie.popularity })}, now())
        on conflict (tmdb_id) where tmdb_id is not null do update set
          title = excluded.title, original_title = excluded.original_title, release_year = excluded.release_year,
          synopsis = excluded.synopsis, poster_path = excluded.poster_path, backdrop_path = excluded.backdrop_path,
          metadata = excluded.metadata, tmdb_last_synced_at = now()
        returning id`;
      const movieRow = movieRows[0]!;
      const ticketUrl = input.item.ticketUrl ?? input.item.detailUrl;
      const showtimeRows = await sql<{ id: string }[]>`
        insert into showtimes (theatre_id, movie_id, raw_source_item_id, source_uid, display_title, starts_at, ends_at,
          ticket_url, status, last_seen_at)
        values (${theatre.id}, ${movieRow.id}, ${raw.id}, ${input.item.sourceUid}, ${input.item.rawTitle},
          ${input.item.startsAt}, ${input.item.endsAt ?? null}, ${ticketUrl}, ${input.item.status}, now())
        on conflict (theatre_id, source_uid) do update set movie_id = excluded.movie_id,
          raw_source_item_id = excluded.raw_source_item_id, display_title = excluded.display_title,
          starts_at = excluded.starts_at, ends_at = excluded.ends_at, ticket_url = excluded.ticket_url,
          status = excluded.status, is_active = true, last_seen_at = now()
        returning id`;
      for (const label of [...new Set([...input.item.tags, ...input.normalized.tags])]) {
        const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const category = /mm|restoration/i.test(label) ? "format" : /caption/i.test(label) ? "accessibility" : "experience";
        await sql`insert into tags (slug, label, category) values (${slug}, ${label}, ${category}) on conflict (slug) do nothing`;
        await sql`insert into showtime_tags (showtime_id, tag_id, source_text)
          select ${showtimeRows[0]!.id}, id, ${label} from tags where slug = ${slug}
          on conflict do nothing`;
      }
      return { status: "matched" as const, movieId: movieRow.id };
    });
  }

  async close(): Promise<void> { await this.sql.end(); }
}
