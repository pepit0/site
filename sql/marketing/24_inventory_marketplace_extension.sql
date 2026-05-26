-- Chrome Marketplace Lister extension: Facebook listing flags + optional list price.
-- Run as postgres on the marketing Supabase project after prior inventory migrations.

alter table public.inventory_units
  add column if not exists posted_to_marketplace boolean not null default false,
  add column if not exists marketplace_listed_at timestamptz,
  add column if not exists marketplace_list_price numeric(12, 2);

comment on column public.inventory_units.posted_to_marketplace is
  'Set true when staff marks unit listed via Marketplace Lister Chrome extension.';
comment on column public.inventory_units.marketplace_listed_at is
  'ISO timestamp when posted_to_marketplace was set (from extension PATCH).';
comment on column public.inventory_units.marketplace_list_price is
  'Optional Facebook listing price; API uses COALESCE(marketplace_list_price, cost).';
