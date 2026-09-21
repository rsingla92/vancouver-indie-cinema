# Step 1 — System Architecture

## Architectural shape

The project is a TypeScript monorepo with three runtime boundaries:

1. **Web PWA** — Next.js App Router renders the mobile-first browsing experience and exposes read-only internal API routes.
2. **Ingestion worker** — scheduled Node.js jobs fetch raw venue schedules, normalize records, enrich movies through TMDB, and upsert canonical entities.
3. **PostgreSQL** — Supabase stores source provenance, canonical movies, venue screenings, tags, and ingestion history.

```mermaid
flowchart TD
  V[Venue sources] --> I[Ingestion worker]
  I --> N[Normalization + TMDB]
  N --> D[(Supabase Postgres)]
  D --> A[Next.js API routes]
  A --> P[Installable PWA]
  P --> T[External ticket page]
```

The web application never calls venue systems or the LLM directly. The ingestion worker is the only writer for schedule data. The client receives normalized, cacheable projections from internal API routes.

## Proposed repository structure

```text
vancouver-indie-cinema/
├── apps/
│   ├── web/                         # Next.js App Router PWA
│   │   ├── app/
│   │   │   ├── (browse)/            # Today, calendar, theatres, saved views
│   │   │   ├── api/movies/today/    # Internal read API (Step 5)
│   │   │   ├── manifest.ts          # Web App Manifest
│   │   │   └── offline/             # Offline fallback route
│   │   ├── components/              # Mobile UI and shadcn/ui wrappers
│   │   ├── lib/                     # Queries, formatters, PWA helpers
│   │   └── public/                  # Icons and static assets
│   └── worker/                      # Scheduled Node.js ingestion service
│       └── src/
│           ├── extractors/          # One venue adapter per source
│           ├── normalize/           # LLM sanitization and match scoring
│           ├── enrich/              # TMDB client and metadata merge
│           ├── pipelines/           # Idempotent ingestion orchestration
│           └── jobs/                # Scheduler entry points
├── packages/
│   ├── db/                          # Generated DB types and shared queries
│   ├── domain/                      # Zod schemas and domain types
│   ├── config/                      # Shared TypeScript/lint configuration
│   └── observability/               # Structured logs and ingestion metrics
├── supabase/
│   └── migrations/                  # Versioned PostgreSQL migrations
├── docs/                            # Architecture and source findings
├── .github/workflows/               # CI and scheduled worker invocation
├── pnpm-workspace.yaml
└── turbo.json
```

Folders for later steps are documented here but are not scaffolded yet, keeping this commit limited to architecture and schema.

## Data flow and identity

1. An extractor emits a `raw_source_items` record with the original payload and a stable source key.
2. A normalization pass extracts a core title, optional year, event flags, and confidence. Its prompt/model metadata is retained for auditability.
3. TMDB candidates are evaluated. Automatic linking requires a configurable confidence threshold; uncertain records remain reviewable instead of being forced into a wrong movie.
4. A canonical `movies` row is created or reused. A partial unique index ensures one row per TMDB movie.
5. A `showtimes` row links the movie, theatre, and source item. Its external ticket URL is the only purchase CTA.
6. Format and experience labels such as `35mm`, `Q&A`, `Live Score`, or `Members Only` are normalized into reusable `tags` joined through `showtime_tags`.

`showtimes.source_uid` is the ingestion idempotency key. It should be derived from the venue's stable event/session ID when available, not from display text. Each successful run marks currently observed rows active; later reconciliation can mark disappeared future sessions cancelled without destroying history.

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
- **Timestamps use `timestamptz`.** Venue-local presentation uses the theatre's IANA timezone (`America/Vancouver` by default).
- **No ticket inventory is represented.** Availability is informational and the authoritative action is always the external URL.

## PWA and caching boundary

The service worker should precache the application shell and use stale-while-revalidate for poster images. Schedule API responses should use network-first with a bounded cached fallback and display a visible “last updated” timestamp. Ticket URLs must never be treated as usable offline; the UI should explain that connectivity is required to continue to the theatre.

## Security and operations

- Browser clients receive only read access to published schedule projections.
- Supabase service-role credentials, TMDB credentials, and LLM credentials remain server-only.
- Extraction payloads are untrusted input and must be schema-validated before persistence.
- Raw payload retention should be bounded by a cleanup policy once replay requirements are understood.
- Logs should include `ingestion_run_id`, `theatre_id`, and source identifiers, but never credentials or full request headers.
- Row Level Security should deny anonymous writes. Public reads can later be exposed through a constrained view or server API.

## Deliberately deferred

The following belong to later approved steps: live investigation of venue endpoints, extractor implementations, LLM prompts/provider selection, TMDB matching thresholds, API route code, UI components, service-worker implementation, CI, and deployment.
