-- Sell your ride: public submissions queue + RPCs (marketing Supabase).
-- Run after 01_inventory_units.sql (FK to inventory_units). Role: postgres.

create table if not exists public.sell_ride_submissions (
  id uuid primary key default gen_random_uuid (),
  status text not null default 'draft',
  seller_first_name text,
  seller_last_name text,
  seller_phone text,
  seller_email text,
  year integer,
  make text,
  model text,
  odometer_km integer,
  category text,
  seller_notes text,
  photo_paths text[] not null default '{}'::text[],
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now (),
  submitted_at timestamptz,
  published_inventory_id uuid references public.inventory_units (id) on delete set null,
  rejected_reason text,
  constraint sell_ride_submissions_status_check check (
    status in ('draft', 'submitted', 'published', 'rejected')
  ),
  constraint sell_ride_submissions_category_check check (
    category is null
    or category in (
      'Motorcycle',
      'ATV',
      'Snowmobile',
      'Side by side',
      'Watercraft'
    )
  )
);

create index if not exists sell_ride_submissions_status_submitted_at_idx
on public.sell_ride_submissions (status, submitted_at desc nulls last);

create index if not exists sell_ride_submissions_created_at_idx on public.sell_ride_submissions (created_at desc);

drop trigger if exists sell_ride_submissions_set_updated_at on public.sell_ride_submissions;

create trigger sell_ride_submissions_set_updated_at
before update on public.sell_ride_submissions
for each row
execute function public.inventory_set_updated_at ();

alter table public.sell_ride_submissions enable row level security;

-- Admins list/update queue rows (publish flow is client-orchestrated + these updates).
create policy sell_ride_submissions_admin_select on public.sell_ride_submissions
for select to authenticated
using (public.user_can_manage_inventory ());

create policy sell_ride_submissions_admin_update on public.sell_ride_submissions
for update to authenticated
using (public.user_can_manage_inventory ())
with check (public.user_can_manage_inventory ());

grant select, update on public.sell_ride_submissions to authenticated;

-- ---------------------------------------------------------------------------
-- Public RPCs (anon): draft id for uploads, then submit with fields + paths.
-- ---------------------------------------------------------------------------

create or replace function public.sell_ride_begin_draft () returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.sell_ride_submissions (status)
  values ('draft')
  returning id into new_id;

  return json_build_object('ok', true, 'error', null, 'id', new_id::text);
exception
  when others then
    return json_build_object('ok', false, 'error', sqlerrm, 'id', null);
end;
$$;

grant execute on function public.sell_ride_begin_draft () to anon, authenticated;

create or replace function public.sell_ride_submit (
  p_id uuid,
  p_seller_first_name text,
  p_seller_last_name text,
  p_seller_phone text,
  p_seller_email text,
  p_year integer,
  p_make text,
  p_model text,
  p_odometer_km integer,
  p_category text,
  p_seller_notes text,
  p_photo_paths text[]
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_path text;
  v_phone_digits text;
begin
  if p_id is null then
    return json_build_object('ok', false, 'error', 'Missing submission id.');
  end if;

  if not exists (
    select 1
    from public.sell_ride_submissions s
    where s.id = p_id
      and s.status = 'draft'
      and s.created_at > now() - interval '24 hours'
  ) then
    return json_build_object('ok', false, 'error', 'Invalid or expired draft submission.');
  end if;

  if coalesce(trim(p_seller_first_name), '') = '' or coalesce(trim(p_seller_last_name), '') = '' then
    return json_build_object('ok', false, 'error', 'First and last name are required.');
  end if;

  v_phone_digits := regexp_replace(coalesce(p_seller_phone, ''), '\D', '', 'g');
  if length(v_phone_digits) < 10 then
    return json_build_object('ok', false, 'error', 'Enter a valid phone number.');
  end if;

  if p_year is null or p_year < 1900 or p_year > 2100 then
    return json_build_object('ok', false, 'error', 'Enter a valid year.');
  end if;

  if coalesce(trim(p_make), '') = '' or coalesce(trim(p_model), '') = '' then
    return json_build_object('ok', false, 'error', 'Make and model are required.');
  end if;

  if p_odometer_km is null or p_odometer_km < 0 then
    return json_build_object('ok', false, 'error', 'Odometer (km) is required.');
  end if;

  if p_category is null or p_category not in (
    'Motorcycle',
    'ATV',
    'Snowmobile',
    'Side by side',
    'Watercraft'
  ) then
    return json_build_object('ok', false, 'error', 'Choose a valid category.');
  end if;

  if p_photo_paths is null or coalesce(array_length(p_photo_paths, 1), 0) < 3 then
    return json_build_object('ok', false, 'error', 'At least three photos are required.');
  end if;

  v_prefix := p_id::text || '/';

  foreach v_path in array p_photo_paths
  loop
    if v_path is null or position('..' in v_path) > 0 then
      return json_build_object('ok', false, 'error', 'Invalid photo path.');
    end if;
    if left(v_path, length(v_prefix)) is distinct from v_prefix then
      return json_build_object('ok', false, 'error', 'Invalid photo path.');
    end if;
    if length(v_path) <= length(v_prefix) then
      return json_build_object('ok', false, 'error', 'Invalid photo path.');
    end if;
  end loop;

  update public.sell_ride_submissions
  set
    status = 'submitted',
    seller_first_name = trim(p_seller_first_name),
    seller_last_name = trim(p_seller_last_name),
    seller_phone = v_phone_digits,
    seller_email = case
      when nullif(trim(coalesce(p_seller_email, '')), '') is null then null
      else lower(trim(p_seller_email))
    end,
    year = p_year,
    make = trim(p_make),
    model = trim(p_model),
    odometer_km = p_odometer_km,
    category = p_category,
    seller_notes = nullif(trim(coalesce(p_seller_notes, '')), ''),
    photo_paths = p_photo_paths,
    submitted_at = now()
  where id = p_id
    and status = 'draft';

  if not found then
    return json_build_object('ok', false, 'error', 'Could not finalize submission.');
  end if;

  return json_build_object('ok', true, 'error', null);
exception
  when others then
    return json_build_object('ok', false, 'error', sqlerrm);
end;
$$;

grant execute on function public.sell_ride_submit (
  uuid,
  text,
  text,
  text,
  text,
  integer,
  text,
  text,
  integer,
  text,
  text,
  text[]
) to anon, authenticated;
