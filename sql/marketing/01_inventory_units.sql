-- Marketing Supabase: inventory units + admin allowlist + public catalog view.
--
-- IMPORTANT — Role in SQL Editor
-- Use **postgres** (default owner). If the editor is set to `anon` or
-- `authenticated`, CREATE TABLE fails with: permission denied for schema public.
-- If that still happens after switching role, run `00_public_schema_for_owner.sql` once.
--
-- Run in Supabase SQL Editor (marketing project), then `02_storage_inventory_photos.sql`.

-- ---------------------------------------------------------------------------
-- Admins: create users in Authentication, then:
--   insert into public.inventory_admins (user_id) values ('<uuid>');
-- ---------------------------------------------------------------------------

create table if not exists public.inventory_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.inventory_admins enable row level security;

create table if not exists public.inventory_units (
  id uuid primary key default gen_random_uuid (),
  stock_number text not null,
  year integer not null,
  make text not null,
  model text not null,
  odometer_km integer,
  category text not null,
  cost numeric(12, 2) not null default 0,
  photo_paths text[] not null default '{}'::text[],
  status text not null default 'Available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_units_stock_number_key unique (stock_number),
  constraint inventory_units_category_check check (
    category in (
      'Motorcycle',
      'ATV',
      'Snowmobile',
      'Side by side',
      'Watercraft'
    )
  ),
  constraint inventory_units_status_check check (
    status in ('Available', 'Pending', 'Sold', 'Unlisted')
  )
);

create index if not exists inventory_units_category_idx on public.inventory_units (category);
create index if not exists inventory_units_year_idx on public.inventory_units (year desc);

-- Public catalog: invoker off so rows read with view owner rights (cost column omitted from projection).
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

-- RPC for app + storage policies
create or replace function public.user_can_manage_inventory ()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.inventory_admins a
    where a.user_id = auth.uid ()
  );
$$;

grant execute on function public.user_can_manage_inventory () to anon, authenticated;

-- updated_at trigger
create or replace function public.inventory_set_updated_at ()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists inventory_units_set_updated_at on public.inventory_units;

create trigger inventory_units_set_updated_at
before update on public.inventory_units
for each row
execute function public.inventory_set_updated_at ();

alter table public.inventory_units enable row level security;

-- Inventory admins: full CRUD
create policy inventory_units_admin_all on public.inventory_units
for all to authenticated
using (public.user_can_manage_inventory ())
with check (public.user_can_manage_inventory ());

-- Grants: RLS still applies
grant select, insert, update, delete on public.inventory_units to authenticated;
