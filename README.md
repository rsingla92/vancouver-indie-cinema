# Double Bill

Independent cinema showtimes, starting with Vancouver. A mobile-first static site that lists what the city's independent and repertory screens are playing; ticket purchases stay on each venue's own site.

## Project status

The pipeline is complete: source extraction, deterministic title normalization, guarded TMDB matching, idempotent PostgreSQL persistence with per-run reconciliation, JSON data files, and an installable mobile-first site. It has no LLM or generative-AI runtime dependency. The site is built for more than one city; only Vancouver has extractors so far (see [Cities](#cities)).

## Stack

- Next.js App Router as a static export, React, TypeScript, Tailwind CSS
- Neon PostgreSQL (free tier)
- Node.js ingestion worker on GitHub Actions
- GitHub Pages for hosting
- TMDB for canonical movie metadata
- `@ctrl/video-filename-parser` as a guarded final pass for release-style suffixes
- `fast-fuzzy` for deterministic title similarity
- Web App Manifest and service worker for installability and offline schedule access

## Key artifacts

- [`docs/architecture.md`](docs/architecture.md): boundaries, data flow, folder structure, and design decisions
- [`docs/hidden-api-hunt.md`](docs/hidden-api-hunt.md): source investigation and Network-tab capture protocol
- [`db/migrations/001_initial_schema.sql`](db/migrations/001_initial_schema.sql): relational schema
- [`db/migrations/002_normalization_pipeline.sql`](db/migrations/002_normalization_pipeline.sql): match-review state and read policies
- [`db/migrations/003_seed_theatres.sql`](db/migrations/003_seed_theatres.sql) and [`004_seed_park_theatre.sql`](db/migrations/004_seed_park_theatre.sql): the venues the worker ingests

## Local setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set `DATABASE_URL` and `TMDB_API_TOKEN`. Without `DATABASE_URL`, the UI uses labelled demo listings for visual development. `npm run build --workspace=@vic/web` writes the static site to `apps/web/out`.

Apply the SQL migrations in order. The seed migrations are idempotent and must run before the worker, which resolves each venue by slug.

## Cities

Every theatre carries a `city` and an IANA `timezone`, the JSON files include both, and the site shows a city picker in the dateline as soon as the data holds more than one city. Times are always shown in the theatre's own zone. Adding a city means seeding its theatres (a migration like `004_seed_park_theatre.sql`) and writing one extractor per venue under `apps/worker/src/extractors/`; nothing in the web app changes. Candidate venues for Toronto, Montreal and other Canadian cities are tracked in the repository's issues.

## Ingestion

```bash
npm run ingest                                    # every venue, 60-day horizon
npm run ingest -- --days=30 --venues=rio-theatre  # narrower run
```

For each venue the job records an `ingestion_runs` row, fetches the schedule, normalizes every title, links confident TMDB matches, and upserts `showtimes`. Future showtimes that a complete extraction no longer lists are marked inactive; history is never deleted. Venue slugs are `rio-theatre`, `park-theatre`, `the-cinematheque`, `viff-centre`, and `hollywood-theatre`. The Rio and the Park share one adapter for the Barker events plugin their sites run.

The normalizer strips known venue prefixes, series labels, and format/event suffixes, extracts a release year only when the listing sets one apart (for example `(1978)`), then ranks TMDB results by title similarity, year agreement, and popularity. A movie is persisted only when the leading candidate clears both the confidence threshold and ambiguity margin; uncertain items remain in `raw_source_items` with `normalization_status = 'review'`.

## Hosting

The site is a static export served by GitHub Pages. It is rebuilt from the database after every ingest and on every push to `main` that touches the site. Past showtimes are hidden in the browser, so a page left open stays current between builds. The database is a free Neon Postgres project. Nothing costs money.

1. Create a Neon project and copy its pooled connection string (it ends in `?sslmode=require`). Apply the migrations to it:

   ```bash
   for f in db/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done
   ```

2. Add the repository secrets `DATABASE_URL` and `TMDB_API_TOKEN`.
3. In Settings → Pages, set the source to "GitHub Actions".
4. Push to `main`, or run the "Deploy site to GitHub Pages" workflow by hand.

The deploy workflow refuses to build when `DATABASE_URL` is missing, so a forgotten secret cannot publish the sample listings, and the page build fails when the database holds no upcoming showtimes, so a broken ingest cannot publish an empty schedule. The ingest workflow checks both secrets before it starts. To preview the sample data on Pages anyway, run the workflow by hand with the "demo" option.

A project site is served under `/<repository>/`; the build reads that prefix from the Pages configuration, so moving to a custom domain needs no code change. Because the site is a snapshot, same-day changes such as a screening selling out appear after the next build.

## Automation

- `.github/workflows/ci.yml` runs typecheck, tests and the build on every push to `main` and every pull request.
- `.github/workflows/ingest.yml` runs the ingestion job three times a day, at 9 a.m., 1 p.m. and 5 p.m. Vancouver time, then redeploys the site. GitHub schedules in UTC, so each local time is scheduled at both possible offsets and the first job skips the one that does not land on a local hour. It can also be started by hand from the Actions tab with a custom horizon or venue list.
- `.github/workflows/deploy-pages.yml` builds and publishes the site. `pages.yml` calls it on pushes to `main` that change the site.

## Data files

The build also writes two JSON files next to the page:

- `/api/showtimes.json`: upcoming showtimes through the end of the 14th Vancouver calendar day
- `/api/today.json`: the rest of the build day in Vancouver time

Both hold `{ data, meta }` where `meta.generatedAt` is the build time and `meta.demo` flags preview data.

## Verification

```bash
npm test
npm run typecheck
npm run build
```

The worker also has a repository test that runs against a real database with the migrations applied. It is skipped unless `DATABASE_URL` is set:

```bash
DATABASE_URL=postgres://user:pass@localhost:5432/vic npm test --workspace=@vic/worker
```

## Delivery status

1. System architecture and database schema — complete
2. Hidden API hunt — complete
3. Data extraction scripts — complete
4. Deterministic normalization and TMDB merging — complete
5. API routes and PWA frontend — complete
6. Scheduled ingestion job with run history and reconciliation — complete
