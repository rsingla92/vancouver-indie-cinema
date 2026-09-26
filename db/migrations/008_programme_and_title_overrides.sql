begin;

-- A venue's programme settles same-title ties the listing itself cannot: a
-- first-run house or a festival showing "Fatherland" means the current one.
-- Repertory and mixed venues get no preference; there a tie stays a tie.
update public.theatres
  set source_config = source_config || '{"programme": "first_run"}'::jsonb
  where slug in ('kingsway-theatre', 'carlton-cinema', 'cinema-beaubien');
update public.theatres
  set source_config = source_config || '{"programme": "festival"}'::jsonb
  where slug = 'viff-centre';

-- Pins for the titles no rule will ever settle. The title is compared the way the
-- matcher compares titles (case, accents and punctuation ignored), so write it as
-- the venue prints it. A theatre_slug of '*' applies at every venue.
create table if not exists public.title_overrides (
  theatre_slug text not null default '*',
  title text not null,
  tmdb_id bigint not null,
  note text,
  created_at timestamptz not null default now(),
  primary key (theatre_slug, title)
);
alter table public.title_overrides enable row level security;

commit;
