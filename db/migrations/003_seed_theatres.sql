begin;

-- Venue rows the ingestion worker resolves by slug. Slugs must match the
-- venueSlugSchema enum in apps/worker/src/contracts.ts. Re-running this
-- migration refreshes the descriptive columns without touching identity.
insert into public.theatres
  (slug, name, website_url, ticketing_base_url, source_kind, source_url, address_line1, postal_code)
values
  ('rio-theatre', 'Rio Theatre', 'https://riotheatre.ca', 'https://riotheatretickets.ca',
   'hidden_api', 'https://riotheatre.ca/wp-json/barker/v1/listings', '1660 E Broadway', 'V5N 1W1'),
  ('the-cinematheque', 'The Cinematheque', 'https://thecinematheque.ca', 'https://tickets.thecinematheque.ca',
   'dom', 'https://thecinematheque.ca/films', '1131 Howe St', 'V6Z 2L7'),
  ('viff-centre', 'VIFF Centre', 'https://viff.org', 'https://viff.org',
   'dom', 'https://viff.org/whats-on/', '1181 Seymour St', 'V6B 3M7'),
  ('hollywood-theatre', 'Hollywood Theatre', 'https://www.hollywoodtheatre.ca', null,
   'dom', 'https://www.hollywoodtheatre.ca/events', '3123 W Broadway', 'V6K 2H2')
on conflict (slug) do update set
  name = excluded.name,
  website_url = excluded.website_url,
  ticketing_base_url = excluded.ticketing_base_url,
  source_kind = excluded.source_kind,
  source_url = excluded.source_url,
  address_line1 = excluded.address_line1,
  postal_code = excluded.postal_code;

commit;
