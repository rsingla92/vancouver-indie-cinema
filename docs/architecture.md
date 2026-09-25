# Architecture

## Architectural shape

The project is a TypeScript monorepo with three runtime boundaries:

1. **Web PWA** — Next.js App Router, exported as a static site at build time and served by GitHub Pages, with read-only JSON data files beside the page.
2. **Ingestion worker** — scheduled Node.js jobs fetch raw venue schedules, normalize records, enrich movies through TMDB, and upsert canonical entities.
3. **PostgreSQL** — a Neon project stores source provenance, canonical movies, venue screenings, tags, and ingestion history.

```mermaid
flowchart TD
  V[Venue sources] --> I[Ingestion worker]
  I --> N[Normalization + TMDB]
  N --> D[(Neon Postgres)]
  D --> A[Static export at build time]
  A --> P[GitHub Pages PWA]
  P --> T[External ticket page]
```

The web application never calls venue systems or TMDB directly. The ingestion worker is the only writer for schedule data. The site is built from the database after each ingest, so the browser receives a normalized, cacheable snapshot rather than live queries.

## Repository structure

```text
vancouver-indie-cinema/
├── apps/
│   ├── web/                         # Next.js App Router PWA
│   │   ├── app/
│   │   │   ├── api/showtimes.json/  # 14-day listing, written at build time
│   │   │   ├── api/today.json/      # The rest of the build day
│   │   │   ├── manifest.ts          # Web App Manifest
│   │   │   └── page.tsx             # Listing page, rendered at build time
│   │   ├── components/              # Masthead, pick, listings
│   │   ├── hooks/                   # Clock and city choice
│   │   ├── lib/                     # Postgres client, projections, formatting, demo data
│   │   └── public/                  # Icons and the service worker
│   └── worker/                      # Node.js ingestion service
│       ├── src/
│       │   ├── extractors/          # One venue adapter per source
│       │   ├── normalization/       # Title rules and normalizer, TMDB ranking, repository
│       │   └── jobs/ingest.ts       # Run orchestration and reconciliation
│       └── test/                    # Vitest suites with fixture HTML/JSON
├── db/migrations/                   # Versioned PostgreSQL migrations and venue seeds
└── docs/                            # Architecture and source findings
```

## Data flow and identity

1. An extractor emits a `raw_source_items` record with the original payload and a stable source key.
2. A deterministic normalization pass extracts a core title, optional year, event flags, and confidence. The rules version and full output are retained on the raw item so a rules change can be replayed and audited.
3. TMDB candidates are evaluated. Automatic linking requires a configurable confidence threshold; an uncertain record is listed under its own title, without a movie, rather than forced into a wrong one, and stays reviewable.
4. A canonical `movies` row is created or reused. A partial unique index ensures one row per TMDB movie.
5. A `showtimes` row links the movie, theatre, and source item. Its external ticket URL is the only purchase CTA.
6. Format and experience labels such as `35mm`, `Q&A`, `Live Score`, or `Members Only` are normalized into reusable `tags` joined through `showtime_tags`.

`showtimes.source_uid` is the ingestion idempotency key. It is derived from the venue's stable event/session ID when available, not from display text. Each run marks currently observed rows active. When an extraction completes without warnings, future showtimes it no longer lists are marked inactive rather than deleted, so history survives and a partial fetch can never hide a whole schedule.

## Ingestion job

`apps/worker/src/jobs/ingest.ts` runs every venue concurrently and isolates failures per venue. Each venue gets an `ingestion_runs` row that records fetched, upserted, and error counts plus a metadata summary; every `raw_source_items` revision points back to the run that produced it. Only Rio accepts a date range, so the horizon (`--days`, default 60) bounds both that request and the reconciliation window.

## Relational model

| Table | Responsibility |
|---|---|
| `theatres` | Venue identity, location, timezone, and source configuration |
| `movies` | One canonical film entity, preferably linked to TMDB |
| `raw_source_items` | Immutable-ish source evidence and normalization audit trail |
| `showtimes` | A scheduled screening with ticket deep-link and lifecycle status |
| `tags` | Controlled metadata vocabulary such as formats and special events |
| `showtime_tags` | Many-to-many association with optional source text |
| `ingestion_runs` | Per-source operational history and counts |

Important choices:

- **Special events are modeled as tags, not a parallel event table.** A Q&A or 35mm presentation remains attached to a screening and composes naturally with other tags. A future non-film event can use `showtimes.kind = 'special_event'` with a nullable movie.
- **Movie and showtime data are separated.** Multiple theatres can point to one TMDB-backed movie while retaining distinct times, auditoria, ticket links, and tags.
- **Raw source evidence is retained.** Parser and normalization changes can be replayed without immediately refetching a venue.
- **Timestamps use `timestamptz`.** Venue-local presentation uses the theatre's IANA timezone, which travels with the theatre in the JSON files so cities in different zones can share one build.
- **Cities are data, not code.** A theatre's `city` groups it in the UI; the city picker appears only when more than one city is present.
- **No ticket inventory is represented.** Availability is informational and the authoritative action is always the external URL.

## PWA and caching boundary

The service worker precaches the application shell and uses stale-while-revalidate for poster images. The page and JSON data files use network-first with a cached fallback, and the page shows the build time as “last updated”. The browser hides showtimes that have already started, using its own clock, so a build from the morning still reads correctly in the evening. Ticket URLs must never be treated as usable offline; the UI should explain that connectivity is required to continue to the theatre.

## Security and operations

- Browser clients receive only read access to published schedule projections.
- Database and TMDB credentials remain server-only; the browser only receives read projections.
- Extraction payloads are untrusted input and must be schema-validated before persistence.
- Raw payload retention should be bounded by a cleanup policy once replay requirements are understood.
- Logs should include `ingestion_run_id`, `theatre_id`, and source identifiers, but never credentials or full request headers.
- Row Level Security should deny anonymous writes. Public reads can later be exposed through a constrained view or server API.

## Deliberately deferred

This document was written before implementation. Extractors, normalization rules, TMDB thresholds, API routes, UI, and the service worker now exist under `apps/`. CI, the ingestion schedule (three runs a day), and the GitHub Pages deployment live in `.github/workflows/`.
