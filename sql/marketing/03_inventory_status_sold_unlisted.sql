-- Add Sold + Unlisted statuses; public catalog view hides Unlisted only.
-- Run in Supabase SQL Editor (marketing project, role: postgres) after 01.

alter table public.inventory_units drop constraint if exists inventory_units_status_check;

alter table public.inventory_units
  add constraint inventory_units_status_check check (
    status in ('Available', 'Pending', 'Sold', 'Unlisted')
  );

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
  updated_at
from public.inventory_units
where status in ('Available', 'Pending', 'Sold');

alter view public.inventory_units_public set (security_invoker = false);

grant select on public.inventory_units_public to anon, authenticated;
