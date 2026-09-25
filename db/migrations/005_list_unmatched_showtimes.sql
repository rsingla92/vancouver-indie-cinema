begin;

-- A screening the pipeline could not link to a TMDB film is still a screening.
-- Allow film showtimes without a movie so they can be listed under the title the
-- venue printed; every row must then carry a display title.
do $$
declare kind_check text;
begin
  select conname into kind_check
  from pg_constraint
  where conrelid = 'public.showtimes'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%movie_id is not null%';
  if kind_check is not null then
    execute format('alter table public.showtimes drop constraint %I', kind_check);
  end if;
end $$;

alter table public.showtimes
  add constraint showtimes_title_or_movie check (movie_id is not null or display_title is not null);

commit;
