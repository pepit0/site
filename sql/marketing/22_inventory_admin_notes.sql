-- Internal admin notes on catalog units (never exposed on inventory_units_public).
-- Run as postgres after 18_inventory_customer_units.sql.

alter table public.inventory_units
  add column if not exists admin_notes text;
