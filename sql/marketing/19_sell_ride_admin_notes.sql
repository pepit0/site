-- Admin-only notes on sell-your-ride submissions (separate from customer seller_notes).
-- Run as postgres after 06_sell_ride_submissions.sql.

alter table public.sell_ride_submissions
  add column if not exists admin_notes text;
