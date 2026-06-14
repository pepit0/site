-- Facebook Marketplace comp search: saved searches + captured listing rows (extension or manual).
-- Run after 01_inventory_units.sql. Role: postgres.

create table if not exists public.marketplace_comp_searches (
  id uuid primary key default gen_random_uuid (),
  inventory_unit_id uuid references public.inventory_units (id) on delete set null,
  year integer,
  make text not null,
  model text not null,
  query_text text not null,
  location_slug text not null default 'edmonton',
  min_price_cad numeric(12, 2),
  max_price_cad numeric(12, 2),
  facebook_search_url text not null,
  created_at timestamptz not null default now (),
  created_by uuid references auth.users (id) on delete set null,
  constraint marketplace_comp_searches_year_check check (year is null or year between 1970 and 2100),
  constraint marketplace_comp_searches_min_price_check check (min_price_cad is null or min_price_cad >= 0),
  constraint marketplace_comp_searches_max_price_check check (max_price_cad is null or max_price_cad >= 0)
);

create index if not exists marketplace_comp_searches_created_idx
on public.marketplace_comp_searches (created_at desc);

create index if not exists marketplace_comp_searches_unit_idx
on public.marketplace_comp_searches (inventory_unit_id)
where inventory_unit_id is not null;

create table if not exists public.marketplace_comp_results (
  id uuid primary key default gen_random_uuid (),
  search_id uuid not null references public.marketplace_comp_searches (id) on delete cascade,
  fb_item_id text,
  title text not null,
  price_text text,
  price_cad numeric(12, 2),
  location_text text,
  listing_url text not null,
  image_url text,
  posted_label text,
  similarity_score smallint,
  scraped_at timestamptz not null default now (),
  constraint marketplace_comp_results_similarity_check check (
    similarity_score is null
    or (similarity_score >= 0 and similarity_score <= 100)
  ),
  constraint marketplace_comp_results_url_unique unique (search_id, listing_url)
);

create index if not exists marketplace_comp_results_search_scraped_idx
on public.marketplace_comp_results (search_id, scraped_at desc);

create index if not exists marketplace_comp_results_similarity_idx
on public.marketplace_comp_results (search_id, similarity_score desc nulls last);

alter table public.marketplace_comp_searches enable row level security;
alter table public.marketplace_comp_results enable row level security;

create policy marketplace_comp_searches_admin_all on public.marketplace_comp_searches
for all to authenticated
using (public.user_can_manage_inventory ())
with check (public.user_can_manage_inventory ());

create policy marketplace_comp_results_admin_all on public.marketplace_comp_results
for all to authenticated
using (public.user_can_manage_inventory ())
with check (public.user_can_manage_inventory ());

grant select, insert, update, delete on public.marketplace_comp_searches to authenticated;
grant select, insert, update, delete on public.marketplace_comp_results to authenticated;
