-- Extend chat_leads for unit selection + visitor message (run after 20_chat_leads.sql).

alter table public.chat_leads
  add column if not exists selected_unit_id uuid,
  add column if not exists selected_unit_label text,
  add column if not exists visitor_message text,
  add column if not exists skipped_unit_pick boolean not null default false;

create or replace function public.submit_public_chat_lead (
  p_display_name text,
  p_phone text,
  p_category text,
  p_year_min integer,
  p_year_max integer,
  p_query_text text,
  p_suggested_unit_ids uuid[],
  p_page_url text,
  p_selected_unit_id uuid default null,
  p_selected_unit_label text default null,
  p_visitor_message text default null,
  p_skipped_unit_pick boolean default false
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
    page_url,
    selected_unit_id,
    selected_unit_label,
    visitor_message,
    skipped_unit_pick
  )
  values (
    trim(p_display_name),
    trim(p_phone),
    nullif(trim(coalesce(p_category, '')), ''),
    p_year_min,
    p_year_max,
    nullif(trim(coalesce(p_query_text, '')), ''),
    coalesce(p_suggested_unit_ids, '{}'::uuid[]),
    nullif(trim(coalesce(p_page_url, '')), ''),
    p_selected_unit_id,
    nullif(trim(coalesce(p_selected_unit_label, '')), ''),
    nullif(trim(coalesce(p_visitor_message, '')), ''),
    coalesce(p_skipped_unit_pick, false)
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
  text,
  uuid,
  text,
  text,
  boolean
) to anon, authenticated;
