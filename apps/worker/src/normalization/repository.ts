import postgres from "postgres";
import type { ExtractedShowtime } from "../contracts.js";
import type { NormalizedTitle, RankedCandidate } from "./contracts.js";

export interface MergeInput {
  item: ExtractedShowtime;
  normalized: NormalizedTitle;
  candidate: RankedCandidate | null;
  payloadHash: string;
  rulesVersion: string;
  ingestionRunId?: string;
}

export type MergeResult =
  | { status: "matched"; movieId: string; showtimeId: string }
  | { status: "review" };

export type IngestionRunStatus = "succeeded" | "partial" | "failed";

export interface IngestionRunSummary {
  status: IngestionRunStatus;
  fetchedCount: number;
  upsertedCount: number;
  errorCount: number;
  errorSummary?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Limits on how much one run may hide. An extraction that silently lost part of
 * a schedule would otherwise deactivate everything it failed to see.
 */
export interface ReconciliationGuard {
  /** Refuse when more than this fraction of the venue's active future showtimes is unseen. */
  maxFraction: number;
  /** ...but only once at least this many rows would be hidden, so small venues can still cancel. */
  minCount: number;
}

export const DEFAULT_RECONCILIATION_GUARD: ReconciliationGuard = { maxFraction: 0.5, minCount: 5 };

export interface DeactivationResult {
  deactivated: number;
  unseen: number;
  active: number;
  skipped: boolean;
}

const NO_CANDIDATE_REASON = "No candidate cleared the confidence and ambiguity thresholds";
const ERROR_SUMMARY_LIMIT = 4000;

export function tagSlug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function tagCategory(label: string): "format" | "accessibility" | "experience" {
  if (/\b(?:\d{2}mm|restoration|restored|remaster(?:ed)?|[24]k|imax|dcp|digital|print)\b/i.test(label)) return "format";
  if (/caption|subtitle|described|accessib|relaxed|sensory/i.test(label)) return "accessibility";
  return "experience";
}

const httpsOrNull = (url: string | undefined): string | null => (url?.startsWith("https://") ? url : null);

export class CinemaRepository {
  private readonly sql: postgres.Sql;

  constructor(databaseUrl = process.env.DATABASE_URL) {
    if (!databaseUrl) throw new Error("DATABASE_URL is required");
    // prepare: false keeps the worker compatible with transaction-mode connection poolers.
    this.sql = postgres(databaseUrl, { max: 4, prepare: false });
  }

  async findTheatreId(slug: string): Promise<string | null> {
    const rows = await this.sql<{ id: string }[]>`select id from theatres where slug = ${slug}`;
    return rows[0]?.id ?? null;
  }

  async startRun(theatreId: string): Promise<string> {
    const rows = await this.sql<{ id: string }[]>`insert into ingestion_runs (theatre_id) values (${theatreId}) returning id`;
    return rows[0]!.id;
  }

  async finishRun(runId: string, summary: IngestionRunSummary): Promise<void> {
    await this.sql`
      update ingestion_runs set status = ${summary.status}, finished_at = now(),
        fetched_count = ${summary.fetchedCount}, upserted_count = ${summary.upsertedCount},
        error_count = ${summary.errorCount}, error_summary = ${summary.errorSummary?.slice(0, ERROR_SUMMARY_LIMIT) ?? null},
        metadata = ${this.sql.json((summary.metadata ?? {}) as postgres.JSONValue)}
      where id = ${runId}`;
  }

  /**
   * Hide future showtimes the source no longer publishes. History is kept; the row
   * simply stops being active. Only rows starting before `until` are considered so a
   * date-bounded fetch never hides sessions it was not asked about, and the guard
   * refuses to hide most of a venue's schedule in one go.
   */
  async deactivateUnseenShowtimes(
    theatreId: string,
    seenSourceUids: string[],
    until: Date,
    guard: ReconciliationGuard = DEFAULT_RECONCILIATION_GUARD,
  ): Promise<DeactivationResult> {
    return this.sql.begin(async (sql) => {
      const counts = await sql<{ active: number; unseen: number }[]>`
        select count(*)::int as active,
          count(*) filter (where source_uid <> all(${seenSourceUids}::text[]))::int as unseen
        from showtimes
        where theatre_id = ${theatreId} and is_active and starts_at > now() and starts_at <= ${until}`;
      const { active, unseen } = counts[0]!;
      if (unseen >= guard.minCount && unseen > active * guard.maxFraction) {
        return { deactivated: 0, unseen, active, skipped: true };
      }
      const result = await sql`
        update showtimes set is_active = false
        where theatre_id = ${theatreId} and is_active and starts_at > now() and starts_at <= ${until}
          and source_uid <> all(${seenSourceUids}::text[])`;
      return { deactivated: result.count, unseen, active, skipped: false };
    });
  }

  async merge(input: MergeInput): Promise<MergeResult> {
    return this.sql.begin(async (sql) => {
      const theatres = await sql<{ id: string }[]>`select id from theatres where slug = ${input.item.venueSlug}`;
      const theatre = theatres[0];
      if (!theatre) throw new Error(`Unknown theatre: ${input.item.venueSlug}`);

      const status = input.candidate ? "matched" : "review";
      const payload = JSON.parse(JSON.stringify(input.item.sourcePayload)) as postgres.JSONValue;
      // The purchase CTA must be an https link; fall back to the venue's own detail page.
      const ticketUrl = httpsOrNull(input.item.ticketUrl) ?? httpsOrNull(input.item.detailUrl);

      const rawRows = await sql<{ id: string }[]>`
        insert into raw_source_items (theatre_id, ingestion_run_id, source_uid, raw_title, source_url, payload, payload_hash,
          normalized_title, normalized_year, normalization_confidence, normalization_method,
          normalization_rules_version, normalization_output, normalization_status, tmdb_candidate_id,
          match_confidence, match_reason, resolved_at)
        values (${theatre.id}, ${input.ingestionRunId ?? null}, ${input.item.sourceUid}, ${input.item.rawTitle}, ${httpsOrNull(input.item.detailUrl)},
          ${sql.json(payload)}, ${input.payloadHash}, ${input.normalized.coreTitle},
          ${input.normalized.releaseYear}, ${input.normalized.confidence}, 'deterministic', ${input.rulesVersion},
          ${sql.json(input.normalized)}, ${status}, ${input.candidate?.movie.id ?? null},
          ${input.candidate?.score ?? null}, ${input.candidate?.reason ?? NO_CANDIDATE_REASON},
          ${input.candidate ? sql`now()` : null})
        on conflict (theatre_id, source_uid, payload_hash) do update set
          fetched_at = now(),
          ingestion_run_id = coalesce(excluded.ingestion_run_id, raw_source_items.ingestion_run_id),
          normalized_title = excluded.normalized_title, normalized_year = excluded.normalized_year,
          normalization_confidence = excluded.normalization_confidence,
          normalization_method = excluded.normalization_method,
          normalization_rules_version = excluded.normalization_rules_version,
          normalization_output = excluded.normalization_output, normalization_status = excluded.normalization_status,
          tmdb_candidate_id = excluded.tmdb_candidate_id, match_confidence = excluded.match_confidence,
          match_reason = excluded.match_reason, resolved_at = excluded.resolved_at
        returning id`;
      const raw = rawRows[0]!;

      if (!input.candidate) {
        // No confident film today, but a showtime linked on an earlier run must still
        // follow the source: keep its film, refresh everything the venue publishes.
        await sql`
          update showtimes set raw_source_item_id = ${raw.id}, display_title = ${input.item.rawTitle},
            starts_at = ${input.item.startsAt}, ends_at = ${input.item.endsAt ?? null},
            ticket_url = coalesce(${ticketUrl}, ticket_url), status = ${input.item.status},
            is_active = true, last_seen_at = now()
          where theatre_id = ${theatre.id} and source_uid = ${input.item.sourceUid}`;
        return { status: "review" };
      }

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

      if (!ticketUrl) throw new Error(`No https ticket or detail URL for ${input.item.venueSlug}/${input.item.sourceUid}`);

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
      const showtime = showtimeRows[0]!;

      const labels = new Map<string, string>();
      for (const label of [...input.item.tags, ...input.normalized.tags]) {
        const slug = tagSlug(label);
        if (slug && !labels.has(slug)) labels.set(slug, label.trim());
      }
      for (const [slug, label] of labels) {
        await sql`insert into tags (slug, label, category) values (${slug}, ${label}, ${tagCategory(label)}) on conflict (slug) do nothing`;
        await sql`insert into showtime_tags (showtime_id, tag_id, source_text)
          select ${showtime.id}::uuid, id, ${label} from tags where slug = ${slug}
          on conflict do nothing`;
      }
      // Tags the source no longer mentions come off the showtime.
      await sql`delete from showtime_tags where showtime_id = ${showtime.id}
        and tag_id not in (select id from tags where slug = any(${[...labels.keys()]}::text[]))`;

      return { status: "matched", movieId: movieRow.id, showtimeId: showtime.id };
    });
  }

  async close(): Promise<void> {
    await this.sql.end();
  }
}
