-- MSF (WooCommerce) bulk import staging: queue rows before posting to inventory_units.
-- Run after 01_inventory_units.sql (FK). Role: postgres.

create table if not exists public.inventory_import_queue (
  id uuid primary key default gen_random_uuid (),
  import_source text not null default 'motorsportsfinancing_wc',
  source_product_id text not null,
  stock_number text not null,
  year integer,
  make text,
  model text,
  odometer_km integer,
  category text not null,
  source_photo_urls text[] not null default '{}'::text[],
  source_permalink text,
  source_product_name text,
  status text not null default 'pending',
  imported_inventory_id uuid references public.inventory_units (id) on delete set null,
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now (),
  constraint inventory_import_queue_source_pid unique (import_source, source_product_id),
  constraint inventory_import_queue_status_check check (
    status in ('pending', 'posted', 'skipped')
  ),
  constraint inventory_import_queue_category_check check (
    category in (
      'Motorcycle',
      'ATV',
      'Snowmobile',
      'Side by side',
      'Watercraft'
    )
  ),
  constraint inventory_import_queue_odometer_check check (
    odometer_km is null
    or odometer_km >= 0
  )
);

create index if not exists inventory_import_queue_status_created_idx
on public.inventory_import_queue (status, created_at desc);

create index if not exists inventory_import_queue_source_idx
on public.inventory_import_queue (import_source);

drop trigger if exists inventory_import_queue_set_updated_at on public.inventory_import_queue;

create trigger inventory_import_queue_set_updated_at
before update on public.inventory_import_queue
for each row
execute function public.inventory_set_updated_at ();

alter table public.inventory_import_queue enable row level security;

create policy inventory_import_queue_admin_all on public.inventory_import_queue
for all to authenticated
using (public.user_can_manage_inventory ())
with check (public.user_can_manage_inventory ());

grant select, insert, update, delete on public.inventory_import_queue to authenticated;
