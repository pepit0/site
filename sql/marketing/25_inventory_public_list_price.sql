-- Optional public list price (website + Product JSON-LD). Run after 03_inventory_status_sold_unlisted.sql.
-- list_price_cad must be appended at the END of the view (PostgreSQL cannot insert columns in the middle via CREATE OR REPLACE).

alter table public.inventory_units
  add column if not exists list_price_cad numeric(12, 2);

comment on column public.inventory_units.list_price_cad is
  'Optional CAD price shown on the public site and in Product/Offer JSON-LD when set.';

create or replace view public.inventory_units_public as
select
  id,
  stock_number,
  year,
  make,
  model,
  odometer_km,
  category,
  status,
  photo_paths,
  created_at,
  updated_at,
  list_price_cad
from public.inventory_units
where status in ('Available', 'Pending', 'Sold');

alter view public.inventory_units_public set (security_invoker = false);

grant select on public.inventory_units_public to anon, authenticated;
