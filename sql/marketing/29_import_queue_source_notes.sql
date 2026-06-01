-- Optional US/source metadata (price, dealer location) for import queue rows.
-- Run after 10_inventory_import_queue.sql.

alter table public.inventory_import_queue
  add column if not exists source_notes text;
