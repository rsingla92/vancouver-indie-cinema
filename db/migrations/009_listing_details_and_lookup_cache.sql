begin;

-- What the venue (or a second database) says about a film when TMDB has nothing:
-- the site shows these in place of a poster, synopsis and year.
alter table public.showtimes
  add column if not exists listing_image_url text check (listing_image_url is null or listing_image_url ~ '^https?://'),
  add column if not exists listing_synopsis text,
  add column if not exists listing_year smallint check (listing_year is null or listing_year between 1888 and 2200);

-- Responses from rate-limited lookups (OMDb allows a thousand a day), kept for a week.
create table if not exists public.lookup_cache (
  provider text not null,
  key text not null,
  response jsonb,
  fetched_at timestamptz not null default now(),
  primary key (provider, key)
);
alter table public.lookup_cache enable row level security;

commit;
