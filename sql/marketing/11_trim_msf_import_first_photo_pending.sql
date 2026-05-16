-- One-time / repeatable: remove the first image URL from every MSF import row still in `pending`.
-- Use when the first Woo image is a studio/marketing tile (e.g. "MSF PICS") for all units.
-- Role: postgres. Safe to run multiple times (each run drops one more leading image while pending).

update public.inventory_import_queue
set source_photo_urls = case
  when coalesce(cardinality(source_photo_urls), 0) <= 1 then '{}'::text[]
  else source_photo_urls[2:cardinality(source_photo_urls)]
end
where import_source = 'motorsportsfinancing_wc'
  and status = 'pending'
  and coalesce(cardinality(source_photo_urls), 0) >= 1;
