-- Add Trailer to inventory + sell-ride category checks; backfill MSF units miscategorized as Motorcycle.
-- Run in Supabase SQL Editor (marketing project). Role: postgres.

alter table public.inventory_units
drop constraint if exists inventory_units_category_check;

alter table public.inventory_units
add constraint inventory_units_category_check check (
  category in (
    'Motorcycle',
    'ATV',
    'Snowmobile',
    'Side by side',
    'Watercraft',
    'Trailer'
  )
);

alter table public.inventory_import_queue
drop constraint if exists inventory_import_queue_category_check;

alter table public.inventory_import_queue
add constraint inventory_import_queue_category_check check (
  category in (
    'Motorcycle',
    'ATV',
    'Snowmobile',
    'Side by side',
    'Watercraft',
    'Trailer'
  )
);

alter table public.sell_ride_submissions
drop constraint if exists sell_ride_submissions_category_check;

alter table public.sell_ride_submissions
add constraint sell_ride_submissions_category_check check (
  category is null
  or category in (
    'Motorcycle',
    'ATV',
    'Snowmobile',
    'Side by side',
    'Watercraft',
    'Trailer'
  )
);

-- MSF Woo uses slug `trailers` for RVs and cargo trailers; previously defaulted to Motorcycle.
update public.inventory_import_queue
set
  category = 'Trailer',
  updated_at = now()
where
  import_source = 'motorsportsfinancing_wc'
  and category = 'Motorcycle'
  and lower(coalesce(source_product_name, '')) ~ '(trailer|winnebago|jayco|keystone|heartland|coachmen|forest river|palomino|starcraft|wilderness|montana|rockwood|camper|motorhome|fifth wheel|haulmark|compass|enclosed|solaire|arcadia|apex|evo|surveyors|bhs)';

update public.inventory_units u
set
  category = 'Trailer',
  updated_at = now()
from public.inventory_import_queue q
where
  q.category = 'Trailer'
  and u.category = 'Motorcycle'
  and (
    q.imported_inventory_id = u.id
    or q.stock_number = u.stock_number
  );

update public.inventory_units
set
  category = 'Trailer',
  updated_at = now()
where
  stock_number ~ '^MSF-[0-9]+$'
  and category = 'Motorcycle'
  and lower(trim(make || ' ' || model)) ~ '(trailer|winnebago|jayco|keystone|heartland|coachmen|forest river|palomino|starcraft|wilderness|montana|rockwood|camper|motorhome|fifth wheel|haulmark|compass|enclosed|solaire|arcadia|apex|evo|surveyors|bhs)';
