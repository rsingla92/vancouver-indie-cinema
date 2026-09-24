# Vancouver Indie Cinema

A mobile-first PWA for discovering independent and arthouse film showtimes in Vancouver, BC. Ticket purchases remain on each venue's own ticketing site.

## Project status

The end-to-end MVP includes source extraction, deterministic title normalization, guarded TMDB matching, idempotent PostgreSQL persistence with per-run reconciliation, browse APIs, and an installable mobile-first PWA. It has no LLM or generative-AI runtime dependency.

## Stack

- Next.js App Router, React, TypeScript, Tailwind CSS
- Supabase PostgreSQL
- Node.js ingestion worker
- TMDB for canonical movie metadata
- `@ctrl/video-filename-parser` as a guarded final pass for release-style suffixes
- `fast-fuzzy` for deterministic title similarity
- Web App Manifest and service worker for installability and offline schedule access

## Key artifacts

- [`docs/architecture.md`](docs/architecture.md): boundaries, data flow, folder structure, and design decisions
- [`docs/hidden-api-hunt.md`](docs/hidden-api-hunt.md): source investigation and Network-tab capture protocol
- [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql): relational schema
- [`supabase/migrations/002_normalization_pipeline.sql`](supabase/migrations/002_normalization_pipeline.sql): match-review state and read policies
- [`supabase/migrations/003_seed_theatres.sql`](supabase/migrations/003_seed_theatres.sql) and [`004_seed_park_theatre.sql`](supabase/migrations/004_seed_park_theatre.sql): the venues the worker ingests

## Local setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set `DATABASE_URL` and `TMDB_API_TOKEN`. Without `DATABASE_URL`, the UI uses labelled demo listings for visual development.

Apply the SQL migrations in order. The seed migrations are idempotent and must run before the worker, which resolves each venue by slug.

## Ingestion

```bash
npm run ingest                                    # every venue, 60-day horizon
npm run ingest -- --days=30 --venues=rio-theatre  # narrower run
```

For each venue the job records an `ingestion_runs` row, fetches the schedule, normalizes every title, links confident TMDB matches, and upserts `showtimes`. Future showtimes that a complete extraction no longer lists are marked inactive; history is never deleted. Venue slugs are `rio-theatre`, `park-theatre`, `the-cinematheque`, `viff-centre`, and `hollywood-theatre`. The Rio and the Park share one adapter for the Barker events plugin their sites run.

The normalizer strips known venue prefixes, series labels, and format/event suffixes, extracts a release year only when the listing sets one apart (for example `(1978)`), then ranks TMDB results by title similarity, year agreement, and popularity. A movie is persisted only when the leading candidate clears both the confidence threshold and ambiguity margin; uncertain items remain in `raw_source_items` with `normalization_status = 'review'`.

## Automation

- `.github/workflows/ci.yml` runs typecheck, tests and the build on every push to `main` and every pull request.
- `.github/workflows/ingest.yml` runs the ingestion job once a day at 9:00 a.m. Vancouver time. GitHub schedules in UTC, so the workflow is scheduled at both 16:00 and 17:00 UTC and skips the run that is not 9 a.m. locally. It can also be started by hand from the Actions tab with a custom horizon or venue list.

The ingest workflow needs two repository secrets: `DATABASE_URL` and `TMDB_API_TOKEN`.

## Read API

- `GET /api/showtimes?days=7`: upcoming showtimes through the end of the Nth Vancouver calendar day (1–14, default 7)
- `GET /api/movies/today`: the rest of today in Vancouver time

Both return `{ data, meta }` where `meta.generatedAt` is the snapshot time and `meta.demo` flags preview data.

## Verification

```bash
npm test
npm run typecheck
npm run build
```

## Delivery status

1. System architecture and database schema — complete
2. Hidden API hunt — complete
3. Data extraction scripts — complete
4. Deterministic normalization and TMDB merging — complete
5. API routes and PWA frontend — complete
6. Scheduled ingestion job with run history and reconciliation — complete
