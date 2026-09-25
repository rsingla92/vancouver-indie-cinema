begin;

-- The Kingsway Theatre's site has no working https at all (its certificate does
-- not cover the domain), and it has no online ticketing, so its schedule page over
-- http is the only link a screening can carry. Keep https where a venue offers it
-- (the worker still prefers it) but let plain http through as the last resort.
alter table public.raw_source_items
  drop constraint if exists raw_source_items_source_url_check,
  add constraint raw_source_items_source_url_check check (source_url is null or source_url ~ '^https?://');

alter table public.showtimes
  drop constraint if exists showtimes_ticket_url_check,
  add constraint showtimes_ticket_url_check check (ticket_url ~ '^https?://');

commit;
