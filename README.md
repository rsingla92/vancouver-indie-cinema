# Vancouver Indie Cinema

A mobile-first PWA for discovering independent and arthouse film showtimes in Vancouver, BC. Ticket purchases remain on each venue's own ticketing site.

## Project status

The end-to-end MVP is implemented: source extraction, LLM-assisted title normalization, guarded TMDB matching, idempotent PostgreSQL persistence, browse APIs, and an installable mobile-first PWA.

## Planned stack

- Next.js App Router, React, TypeScript
- Tailwind CSS and shadcn/ui
- Supabase Postgres
- Node.js ingestion worker, invoked by a scheduled job
- TMDB for canonical movie metadata
- LLM-assisted title normalization with deterministic safeguards
- Web App Manifest and service worker for installability and offline schedule access

## Step 1 artifacts

- [`docs/architecture.md`](docs/architecture.md): boundaries, data flow, folder structure, and design decisions
- [`docs/hidden-api-hunt.md`](docs/hidden-api-hunt.md): observed source architectures and a reproducible Network-tab capture protocol
- [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql): initial relational schema, constraints, and indexes

## Worker verification

```bash
npm install
npm test
npm run typecheck
npm run build
```

The worker is under `apps/worker`; the Next.js PWA is under `apps/web`. Without `DATABASE_URL`, the UI uses clearly labelled demo listings so visual development still works.

## Local setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Apply `supabase/migrations/001_initial_schema.sql` followed by `002_normalization_pipeline.sql`. Set the server-only OpenAI, TMDB, and database credentials from `.env.example`. The title normalizer uses Structured Outputs; the matcher only persists a film when the top TMDB result clears both a score threshold and an ambiguity margin. Everything else stays in `raw_source_items` with `normalization_status = 'review'`.

## Delivery sequence

1. System architecture and database schema — complete
2. Hidden API hunt — complete
3. Data extraction scripts — complete
4. LLM normalization and TMDB merging — complete
5. API routes and PWA frontend — complete
