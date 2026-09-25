begin;

-- Toronto and Montreal venues. Extractors arrive one venue at a time (issues #3
-- and #4); a theatre without an extractor simply has no showtimes yet. Ticketing
-- and source columns are filled in as each extractor lands.
insert into public.theatres
  (slug, name, website_url, ticketing_base_url, source_url, address_line1, city, region, postal_code, timezone)
values
  ('tiff-lightbox', 'TIFF Lightbox', 'https://tiff.net', null, 'https://tiff.net/films', '350 King St W', 'Toronto', 'ON', 'M5V 3X5', 'America/Toronto'),
  ('revue-cinema', 'Revue Cinema', 'https://revuecinema.ca', null, 'https://revuecinema.ca', '400 Roncesvalles Ave', 'Toronto', 'ON', 'M6R 2M9', 'America/Toronto'),
  ('fox-theatre', 'Fox Theatre', 'https://foxtheatre.ca', null, 'https://foxtheatre.ca', '2236 Queen St E', 'Toronto', 'ON', 'M4E 1G2', 'America/Toronto'),
  ('paradise-theatre', 'Paradise Theatre', 'https://paradiseonbloor.com', null, 'https://paradiseonbloor.com', '1006 Bloor St W', 'Toronto', 'ON', 'M6H 1M2', 'America/Toronto'),
  ('the-royal', 'The Royal', 'https://theroyal.to', null, 'https://theroyal.to', '608 College St', 'Toronto', 'ON', 'M6G 1B4', 'America/Toronto'),
  ('hot-docs-cinema', 'Hot Docs Ted Rogers Cinema', 'https://hotdocs.ca', null, 'https://hotdocs.ca', '506 Bloor St W', 'Toronto', 'ON', 'M5S 1Y3', 'America/Toronto'),
  ('carlton-cinema', 'Carlton Cinema', 'https://imaginecinemas.com', null, 'https://imaginecinemas.com', '20 Carlton St', 'Toronto', 'ON', 'M5B 2H5', 'America/Toronto'),
  ('kingsway-theatre', 'Kingsway Theatre', 'https://kingswaymovies.ca', null, 'https://kingswaymovies.ca', '3030 Bloor St W', 'Toronto', 'ON', 'M8X 1C4', 'America/Toronto'),
  ('cinema-du-parc', 'Cinéma du Parc', 'https://cinemaduparc.com', 'https://billetterie.cinemaduparc.com', 'https://www.cinemacinema.ca', '3575 Av du Parc', 'Montreal', 'QC', 'H2X 3P9', 'America/Toronto'),
  ('cinema-beaubien', 'Cinéma Beaubien', 'https://cinemabeaubien.com', 'https://billetterie.cinemabeaubien.com', 'https://www.cinemacinema.ca', '2396 Rue Beaubien E', 'Montreal', 'QC', 'H2G 1N2', 'America/Toronto'),
  ('cinema-du-musee', 'Cinéma du Musée', 'https://cinemadumusee.com', 'https://billetterie.cinemadumusee.com', 'https://www.cinemacinema.ca', '1379A Rue Sherbrooke O', 'Montreal', 'QC', 'H3G 1J5', 'America/Toronto'),
  ('cinema-moderne', 'Cinéma Moderne', 'https://cinemamoderne.com', null, 'https://cinemamoderne.com', '5150 Boul Saint-Laurent', 'Montreal', 'QC', 'H2T 1R8', 'America/Toronto'),
  ('cinema-public', 'Cinéma Public', 'https://cinemapublic.ca', null, 'https://cinemapublic.ca', null, 'Montreal', 'QC', null, 'America/Toronto'),
  ('cinematheque-quebecoise', 'Cinémathèque québécoise', 'https://cinematheque.qc.ca', null, 'https://cinematheque.qc.ca', '335 Boul De Maisonneuve E', 'Montreal', 'QC', 'H2X 1K1', 'America/Toronto')
on conflict (slug) do update set
  name = excluded.name,
  website_url = excluded.website_url,
  ticketing_base_url = excluded.ticketing_base_url,
  source_url = excluded.source_url,
  address_line1 = excluded.address_line1,
  city = excluded.city,
  region = excluded.region,
  postal_code = excluded.postal_code,
  timezone = excluded.timezone;

commit;
