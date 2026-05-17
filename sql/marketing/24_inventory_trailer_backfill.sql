-- Fix MSF RV/trailer units still categorized as Motorcycle (run after 23; safe to re-run).
-- Slug-based fix happens on MSF sync; this broadens DB backfill for rows sync has not touched yet.

-- Queue: use full MSF product title (not make/model alone).
update public.inventory_import_queue
set
  category = 'Trailer',
  updated_at = now()
where
  import_source = 'motorsportsfinancing_wc'
  and category = 'Motorcycle'
  and lower(coalesce(source_product_name, '')) ~ (
    'trailer|camper|motorhome|fifth wheel|winnebago|jayco|keystone|heartland|coachmen|forest river|'
    || 'palomino|starcraft|wilderness|montana|rockwood|solaire|arcadia|apex|evo|surveyor|bhs|haulmark|'
    || 'compass|enclosed|wildcat|nitro|bullet|springdale|flagstaff|cougar|reflection|puma|hideout|'
    || 'cedar creek|sandpiper|cardinal|latitude|imagine|transcend|geo pro|high country|jay flight|'
    || 'm-series|autumn ridge|freedom express|ultra lite|lite ultra| camping | glendale|vibe|'
    || 'passport|venture|bunkhouse|denali|laredo|silverado|avalanche|cyclone|torque|venom|'
    || 'zinger|crusader|sportsmen|durango|hornet|sprinter|voltage|fuzion|'
    || '[0-9]{2,3}(ft|bhs|bh|srk|ws|fb|mbw|rk|bhw)'
  );

-- Catalog: follow corrected queue rows.
update public.inventory_units u
set
  category = 'Trailer',
  updated_at = now()
from public.inventory_import_queue q
where
  q.import_source = 'motorsportsfinancing_wc'
  and q.category = 'Trailer'
  and u.category <> 'Trailer'
  and (
    q.imported_inventory_id = u.id
    or q.stock_number = u.stock_number
  );

-- Catalog: MSF stock still Motorcycle when title (make + model + queue name) looks like RV/trailer.
update public.inventory_units u
set
  category = 'Trailer',
  updated_at = now()
from public.inventory_import_queue q
where
  u.stock_number ~ '^MSF-[0-9]+$'
  and u.category = 'Motorcycle'
  and q.import_source = 'motorsportsfinancing_wc'
  and q.source_product_id = regexp_replace(u.stock_number, '^MSF-', '')
  and lower(
    trim(
      coalesce(q.source_product_name, '') || ' '
      || coalesce(u.make, '') || ' '
      || coalesce(u.model, '')
    )
  ) ~ (
    'trailer|camper|motorhome|fifth wheel|winnebago|jayco|keystone|heartland|coachmen|forest river|'
    || 'palomino|starcraft|wilderness|montana|rockwood|solaire|arcadia|apex|evo|surveyor|bhs|haulmark|'
    || 'compass|enclosed|wildcat|jay flight|high country|autumn ridge|freedom express|ultra lite'
  );
