begin;

create type public.normalization_status as enum ('pending', 'matched', 'review', 'rejected', 'failed');

alter table public.raw_source_items
  add column normalization_status public.normalization_status not null default 'pending',
  add column tmdb_candidate_id bigint,
  add column match_confidence numeric(4,3) check (match_confidence between 0 and 1),
  add column match_reason text,
  add column resolved_at timestamptz;

create index raw_source_items_review_idx
  on public.raw_source_items (normalization_status, fetched_at desc)
  where normalization_status in ('review', 'failed');

create policy "Public can read active theatres" on public.theatres
  for select using (is_active);
create policy "Public can read movies" on public.movies
  for select using (true);
create policy "Public can read active showtimes" on public.showtimes
  for select using (is_active and status in ('scheduled', 'sold_out'));
create policy "Public can read tags" on public.tags
  for select using (true);
create policy "Public can read showtime tags" on public.showtime_tags
  for select using (true);

commit;
