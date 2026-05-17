-- Offline chat assistant leads (marketing site).
-- Run as postgres after 01_inventory_units.sql.

create table if not exists public.chat_leads (
  id uuid primary key default gen_random_uuid (),
  display_name text not null,
  phone text not null,
  category text,
  year_min integer,
  year_max integer,
  query_text text,
  suggested_unit_ids uuid[] not null default '{}'::uuid[],
  page_url text,
  created_at timestamptz not null default now ()
);

create index if not exists chat_leads_created_at_idx on public.chat_leads (created_at desc);

alter table public.chat_leads enable row level security;

-- No SELECT/INSERT policies for anon: writes only via RPC below.

create or replace function public.submit_public_chat_lead (
  p_display_name text,
  p_phone text,
  p_category text,
  p_year_min integer,
  p_year_max integer,
  p_query_text text,
  p_suggested_unit_ids uuid[],
  p_page_url text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if length(trim(coalesce(p_display_name, ''))) < 1 then
    return json_build_object('ok', false, 'error', 'Name is required.', 'id', null);
  end if;
  if length(trim(coalesce(p_phone, ''))) < 7 then
    return json_build_object('ok', false, 'error', 'Phone is required.', 'id', null);
  end if;

  insert into public.chat_leads (
    display_name,
    phone,
    category,
    year_min,
    year_max,
    query_text,
    suggested_unit_ids,
    page_url
  )
  values (
    trim(p_display_name),
    trim(p_phone),
    nullif(trim(coalesce(p_category, '')), ''),
    p_year_min,
    p_year_max,
    nullif(trim(coalesce(p_query_text, '')), ''),
    coalesce(p_suggested_unit_ids, '{}'::uuid[]),
    nullif(trim(coalesce(p_page_url, '')), '')
  )
  returning id into new_id;

  return json_build_object('ok', true, 'error', null, 'id', new_id::text);
exception
  when others then
    return json_build_object('ok', false, 'error', sqlerrm, 'id', null);
end;
$$;

grant execute on function public.submit_public_chat_lead (
  text,
  text,
  text,
  integer,
  integer,
  text,
  uuid[],
  text
) to anon, authenticated;
