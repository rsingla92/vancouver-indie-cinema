# Vancouver Indie Cinema

A mobile-first PWA for discovering independent and arthouse film showtimes in Vancouver, BC. Ticket purchases remain on each venue's own ticketing site.

## Project status

Step 1 is complete: system architecture and the initial PostgreSQL schema. No theatre extraction, hidden-API inspection, normalization integration, or frontend implementation has been started.

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
- [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql): initial relational schema, constraints, and indexes

## Delivery sequence

1. System architecture and database schema — complete
2. Hidden API hunt — awaiting explicit approval
3. Data extraction scripts
4. LLM normalization and TMDB merging
5. API routes and PWA frontend

Work does not advance between steps until the repository owner explicitly types `PROCEED`.
