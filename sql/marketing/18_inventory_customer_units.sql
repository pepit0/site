-- Customer-unit tracking: VIN, reg/insurance flags, sell-submission link (marketing Supabase).
-- Run as postgres after 06_sell_ride_submissions.sql.

alter table public.inventory_units
  add column if not exists vin text,
  add column if not exists is_customer_unit boolean not null default false,
  add column if not exists sell_ride_submission_id uuid references public.sell_ride_submissions (id) on delete set null,
  add column if not exists has_registration boolean,
  add column if not exists has_insurance boolean,
  add column if not exists no_reg_insurance boolean not null default false;

create unique index if not exists inventory_units_sell_ride_submission_id_key
on public.inventory_units (sell_ride_submission_id)
where sell_ride_submission_id is not null;

create index if not exists inventory_units_is_customer_unit_idx
on public.inventory_units (is_customer_unit)
where is_customer_unit = true;
