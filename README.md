# Vancouver Indie Cinema

A mobile-first PWA for discovering independent and arthouse film showtimes in Vancouver, BC. Ticket purchases remain on each venue's own ticketing site.

## Project status

The end-to-end MVP includes source extraction, deterministic title normalization, guarded TMDB matching, idempotent PostgreSQL persistence, browse APIs, and an installable mobile-first PWA. It has no LLM or generative-AI runtime dependency.

## Stack

- Next.js App Router, React, TypeScript, Tailwind CSS
- Supabase PostgreSQL
- Node.js ingestion worker
- TMDB for canonical movie metadata
- `@ctrl/video-filename-parser` for Radarr-style title/year parsing
- `fast-fuzzy` for deterministic title similarity
- Web App Manifest and service worker for installability and offline schedule access

## Key artifacts

- [`docs/architecture.md`](docs/architecture.md): boundaries, data flow, folder structure, and design decisions
- [`docs/hidden-api-hunt.md`](docs/hidden-api-hunt.md): source investigation and Network-tab capture protocol
- [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql): relational schema
- [`supabase/migrations/002_normalization_pipeline.sql`](supabase/migrations/002_normalization_pipeline.sql): match-review state and read policies

## Local setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set `DATABASE_URL` and `TMDB_API_TOKEN`. Without `DATABASE_URL`, the UI uses labelled demo listings for visual development.

Apply the two SQL migrations in order. The normalizer removes known venue prefixes and format/event labels, parses the remaining title and explicit year, then ranks TMDB results by title similarity, year agreement, and popularity. A movie is persisted only when the leading candidate clears both the confidence threshold and ambiguity margin; uncertain items remain in `raw_source_items` with `normalization_status = 'review'`.

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
