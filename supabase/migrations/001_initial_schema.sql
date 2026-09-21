begin;


create extension if not exists pgcrypto;


create type public.source_kind as enum ('hidden_api', 'json_ld', 'ical', 'dom');
create type public.ingestion_status as enum ('running', 'succeeded', 'partial', 'failed');
create type public.showtime_status as enum ('scheduled', 'sold_out', 'cancelled', 'completed');
create type public.showtime_kind as enum ('film', 'special_event');
create type public.tag_category as enum ('format', 'experience', 'accessibility', 'restriction');


create table public.theatres (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  website_url text not null check (website_url ~ '^https://'),
  ticketing_base_url text check (ticketing_base_url is null or ticketing_base_url ~ '^https://'),
  source_kind public.source_kind,
  source_url text check (source_url is null or source_url ~ '^https://'),
  source_config jsonb not null default '{}'::jsonb,
  address_line1 text,
  address_line2 text,
  city text not null default 'Vancouver',
  region text not null default 'BC',
  postal_code text,
  country_code char(2) not null default 'CA',
  timezone text not null default 'America/Vancouver',
  latitude numeric(9,6),
  longitude numeric(9,6),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null and longitude is null) or (latitude is not null and longitude is not null))
);


create table public.movies (
  id uuid primary key default gen_random_uuid(),
  tmdb_id bigint,
  title text not null,
  original_title text,
  release_year smallint check (release_year between 1888 and 2200),
  synopsis text,
  runtime_minutes smallint check (runtime_minutes > 0),
  poster_path text,
  backdrop_path text,
  trailer_url text check (trailer_url is null or trailer_url ~ '^https://'),
  genres jsonb not null default '[]'::jsonb check (jsonb_typeof(genres) = 'array'),
  metadata jsonb not null default '{}'::jsonb,
  tmdb_last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create unique index movies_tmdb_id_unique
  on public.movies (tmdb_id)
  where tmdb_id is not null;


create table public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  status public.ingestion_status not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  fetched_count integer not null default 0 check (fetched_count >= 0),
  upserted_count integer not null default 0 check (upserted_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  error_summary text,
  metadata jsonb not null default '{}'::jsonb,
  check (finished_at is null or finished_at >= started_at)
);


create table public.raw_source_items (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  ingestion_run_id uuid references public.ingestion_runs(id) on delete set null,
  source_uid text not null,
  raw_title text not null,
  source_url text check (source_url is null or source_url ~ '^https://'),
  payload jsonb not null,
  payload_hash text not null,
  normalized_title text,
  normalized_year smallint check (normalized_year between 1888 and 2200),
  normalization_confidence numeric(4,3) check (normalization_confidence between 0 and 1),
  normalization_method text,
  normalization_rules_version text,
  normalization_output jsonb,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (theatre_id, source_uid, payload_hash)
);


create table public.showtimes (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  movie_id uuid references public.movies(id) on delete restrict,
  raw_source_item_id uuid references public.raw_source_items(id) on delete set null,
  source_uid text not null,
  kind public.showtime_kind not null default 'film',
  display_title text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  auditorium text,
  ticket_url text not null check (ticket_url ~ '^https://'),
  status public.showtime_status not null default 'scheduled',
  is_active boolean not null default true,
  source_updated_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (theatre_id, source_uid),
  check (ends_at is null or ends_at > starts_at),
  check (kind <> 'film' or movie_id is not null)
);


create table public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  label text not null,
  category public.tag_category not null,
  description text,
  created_at timestamptz not null default now()
