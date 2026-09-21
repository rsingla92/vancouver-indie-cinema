# Vancouver Indie Cinema

A mobile-first PWA for discovering independent and arthouse film showtimes in Vancouver, BC. Ticket purchases remain on each venue's own ticketing site.

## Project status

Steps 1–3 are complete: system architecture, the initial PostgreSQL schema, source investigation, and typed extraction adapters with parser tests. Normalization, database writes, API routes, and frontend implementation have not started.

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

The Step 3 worker is under `apps/worker`. Extractors return validated raw schedule records only; persistence and title normalization are intentionally deferred.

## Delivery sequence

1. System architecture and database schema — complete
2. Hidden API hunt — complete
3. Data extraction scripts — complete
4. LLM normalization and TMDB merging
5. API routes and PWA frontend

Work does not advance between steps until the repository owner explicitly types `PROCEED`.
