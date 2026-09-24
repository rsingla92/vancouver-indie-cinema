begin;

-- The Park Theatre (3440 Cambie St) reopened in December 2025 under the Rio's
-- management after Cineplex gave up the lease. Its site publishes the schedule
-- through the same Barker events plugin the Rio uses.
insert into public.theatres
  (slug, name, website_url, ticketing_base_url, source_kind, source_url, address_line1, postal_code)
values
  ('park-theatre', 'The Park Theatre', 'https://www.theparktheatre.ca', null,
   'hidden_api', 'https://www.theparktheatre.ca/wp-json/barker/v1/listings', '3440 Cambie St', 'V5Z 2W8')
on conflict (slug) do update set
  name = excluded.name,
  website_url = excluded.website_url,
  ticketing_base_url = excluded.ticketing_base_url,
  source_kind = excluded.source_kind,
  source_url = excluded.source_url,
  address_line1 = excluded.address_line1,
  postal_code = excluded.postal_code;

commit;
