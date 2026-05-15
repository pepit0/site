-- Marketing site -> CRM bridge (run once on the **CRM / finance** Supabase project as postgres).
-- Requires: sql/crm_security.sql, sql/crm_public_preapproval_leads.sql (or equivalent table).
--
-- Creates: crm_system_leads, crm_notifications, ingest RPC, assign RPC, RLS.
-- Allows system-ingested customers with created_by NULL (unassigned until admin assigns).

-- ---------------------------------------------------------------------------
-- Schema extensions
-- ---------------------------------------------------------------------------

alter table public.crm_customers
  alter column created_by drop not null;

alter table public.crm_customers
  add column if not exists profile_metadata jsonb;

-- Website ingest creates the first activity without a staff author.
alter table public.crm_activities
  alter column author_id drop not null;

create unique index if not exists crm_customers_marketing_lead_id_idx
  on public.crm_customers ((profile_metadata ->> 'marketing_lead_id'))
  where (profile_metadata ->> 'marketing_lead_id') is not null;

alter table public.crm_public_preapproval_leads
  add column if not exists marketing_lead_id uuid;

create unique index if not exists crm_public_preapproval_leads_marketing_lead_id_idx
  on public.crm_public_preapproval_leads (marketing_lead_id)
  where marketing_lead_id is not null;

create table if not exists public.crm_system_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  marketing_lead_id uuid not null,
  preapproval_lead_id uuid not null references public.crm_public_preapproval_leads (id) on delete cascade,
  customer_id uuid not null references public.crm_customers (id) on delete cascade,
  assigned_to uuid references auth.users (id) on delete set null,
  assigned_to_email text,
  assigned_at timestamptz,
  constraint crm_system_leads_marketing_lead_id_key unique (marketing_lead_id)
);

create index if not exists crm_system_leads_unassigned_idx
  on public.crm_system_leads (created_at desc)
  where assigned_to is null;

create table if not exists public.crm_notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null default 'system_lead',
  title text not null,
  body text not null,
  system_lead_id uuid references public.crm_system_leads (id) on delete cascade,
  customer_id uuid references public.crm_customers (id) on delete cascade,
  read_at timestamptz
);

create index if not exists crm_notifications_user_unread_idx
  on public.crm_notifications (user_id, created_at desc)
  where read_at is null;

alter table public.crm_system_leads enable row level security;
alter table public.crm_notifications enable row level security;

revoke all on table public.crm_system_leads from public, anon;
revoke all on table public.crm_notifications from public, anon;

grant select, update on table public.crm_system_leads to authenticated;
grant select, update on table public.crm_notifications to authenticated;

drop policy if exists crm_system_leads_select on public.crm_system_leads;
drop policy if exists crm_system_leads_update on public.crm_system_leads;
drop policy if exists crm_notifications_select on public.crm_notifications;
drop policy if exists crm_notifications_update on public.crm_notifications;

create policy crm_system_leads_select on public.crm_system_leads
  for select to authenticated
  using (public.user_has_crm_access());

create policy crm_system_leads_update on public.crm_system_leads
  for update to authenticated
  using (public.user_has_crm_access())
  with check (public.user_has_crm_access());

create policy crm_notifications_select on public.crm_notifications
  for select to authenticated
  using (user_id = auth.uid());

create policy crm_notifications_update on public.crm_notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Ingest (service role / Edge Function only)
-- ---------------------------------------------------------------------------

create or replace function public.ingest_marketing_preapproval_lead(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_marketing_id uuid;
  v_name text;
  v_email text;
  v_phone text;
  v_dob_text text;
  v_dob date;
  v_street text;
  v_line2 text;
  v_city text;
  v_prov text;
  v_employer text;
  v_vehicle text;
  v_income numeric;
  v_consent_contact boolean;
  v_consent_credit boolean;
  v_existing_lead public.crm_system_leads%rowtype;
  v_preapproval_id uuid;
  v_customer_id uuid;
  v_system_lead_id uuid;
  v_metadata jsonb;
  v_comment_body text;
  v_address_line text;
  v_comment_error text;
begin
  v_marketing_id := nullif(trim(coalesce(p_payload ->> 'marketing_lead_id', '')), '')::uuid;
  if v_marketing_id is null then
    return jsonb_build_object('ok', false, 'error', 'marketing_lead_id is required.');
  end if;

  select * into v_existing_lead
  from public.crm_system_leads
  where marketing_lead_id = v_marketing_id;

  if found then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'system_lead_id', v_existing_lead.id::text,
      'customer_id', v_existing_lead.customer_id::text,
      'preapproval_lead_id', v_existing_lead.preapproval_lead_id::text
    );
  end if;

  v_name := trim(coalesce(p_payload ->> 'display_name', ''));
  v_email := lower(trim(coalesce(p_payload ->> 'email', '')));
  v_phone := regexp_replace(coalesce(p_payload ->> 'phone', ''), '\D', '', 'g');
  v_dob_text := trim(coalesce(p_payload ->> 'date_of_birth', ''));
  v_street := trim(coalesce(p_payload ->> 'street', ''));
  v_line2 := nullif(trim(coalesce(p_payload ->> 'line2', '')), '');
  v_city := trim(coalesce(p_payload ->> 'city', ''));
  v_prov := trim(coalesce(p_payload ->> 'province', ''));
  v_employer := trim(coalesce(p_payload ->> 'employer', ''));
  v_vehicle := nullif(trim(coalesce(p_payload ->> 'vehicle_interest', '')), '');
  v_income := nullif(trim(coalesce(p_payload ->> 'gross_monthly_income_cad', '')), '')::numeric;
  v_consent_contact := coalesce((p_payload ->> 'consent_contact')::boolean, false);
  v_consent_credit := coalesce((p_payload ->> 'consent_credit')::boolean, false);

  if v_consent_contact is not true or v_consent_credit is not true then
    return jsonb_build_object('ok', false, 'error', 'Consents are required.');
  end if;

  if length(v_name) < 2 then
    return jsonb_build_object('ok', false, 'error', 'display_name is required.');
  end if;

  if v_email !~ '^[^@]+@[^@]+\.[^@]+$' then
    return jsonb_build_object('ok', false, 'error', 'Valid email is required.');
  end if;

  if length(v_phone) = 11 and left(v_phone, 1) = '1' then
    v_phone := substr(v_phone, 2);
  end if;
  if length(v_phone) <> 10 then
    return jsonb_build_object('ok', false, 'error', 'Valid 10-digit phone is required.');
  end if;

  begin
    v_dob := v_dob_text::date;
  exception
    when others then
      return jsonb_build_object('ok', false, 'error', 'Invalid date_of_birth.');
  end;

  if v_dob > current_date or v_dob < (current_date - interval '120 years') then
    return jsonb_build_object('ok', false, 'error', 'Invalid date_of_birth.');
  end if;

  v_metadata := jsonb_build_object(
    'source', 'marketing',
    'lead_profile', 'Website Lead',
    'marketing_lead_id', v_marketing_id::text,
    'street', v_street,
    'line2', v_line2,
    'city', v_city,
    'province', v_prov,
    'employer', v_employer,
    'gross_monthly_income_cad', v_income,
    'vehicle_interest', v_vehicle
  );

  insert into public.crm_public_preapproval_leads (
    marketing_lead_id,
    display_name,
    email,
    phone,
    date_of_birth,
    street,
    line2,
    city,
    province,
    employer,
    gross_monthly_income_cad,
    vehicle_interest,
    consent_contact,
    consent_credit
  )
  values (
    v_marketing_id,
    v_name,
    v_email,
    v_phone,
    v_dob,
    v_street,
    v_line2,
    v_city,
    v_prov,
    v_employer,
    coalesce(v_income, 0),
    v_vehicle,
    true,
    true
  )
  returning id into v_preapproval_id;

  select c.id into v_customer_id
  from public.crm_customers c
  where lower(coalesce(c.email, '')) = v_email
  limit 1;

  if v_customer_id is null then
    select c.id into v_customer_id
    from public.crm_customers c
    where regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = v_phone
    limit 1;
  end if;

  if v_customer_id is null then
    insert into public.crm_customers (
      created_by,
      display_name,
      email,
      phone,
      date_of_birth,
      status,
      assigned_to,
      assigned_to_email,
      profile_metadata
    )
    values (
      null,
      v_name,
      v_email,
      v_phone,
      v_dob,
      'active',
      null,
      null,
      v_metadata
    )
    returning id into v_customer_id;
  else
    update public.crm_customers c
    set
      display_name = coalesce(nullif(trim(c.display_name), ''), v_name),
      email = coalesce(c.email, v_email),
      phone = coalesce(nullif(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), ''), v_phone),
      date_of_birth = coalesce(c.date_of_birth, v_dob),
      profile_metadata = coalesce(c.profile_metadata, '{}'::jsonb) || v_metadata
    where c.id = v_customer_id;
  end if;

  insert into public.crm_system_leads (
    marketing_lead_id,
    preapproval_lead_id,
    customer_id,
    assigned_to,
    assigned_to_email
  )
  values (
    v_marketing_id,
    v_preapproval_id,
    v_customer_id,
    null,
    null
  )
  returning id into v_system_lead_id;

  insert into public.crm_notifications (user_id, type, title, body, system_lead_id, customer_id)
  select distinct
    notify_user.user_id,
    'system_lead',
    'New system lead',
    v_name || ' submitted a credit pre-approval on the marketing site.',
    v_system_lead_id,
    v_customer_id
  from (
    select d.user_id from public.crm_user_directory d
    union
    select u.id as user_id
    from auth.users u
    inner join public.crm_access_allowlist a on lower(u.email) = lower(a.email)
  ) notify_user;

  v_address_line := v_street;
  if v_line2 is not null and length(v_line2) > 0 then
    v_address_line := v_address_line || ', ' || v_line2;
  end if;
  v_address_line := v_address_line || ', ' || v_city || ', ' || v_prov;

  v_comment_body := format(
    E'Website pre-approval application (submitted on the marketing site)\n\n'
    || E'Name: %s\n'
    || E'Email: %s\n'
    || E'Phone: %s\n'
    || E'Date of birth: %s\n'
    || E'Address: %s\n'
    || E'Employer: %s\n'
    || E'Gross monthly income (CAD): %s\n'
    || E'Vehicle interest: %s\n'
    || E'Consent to contact: %s\n'
    || E'Consent for credit check: %s',
    v_name,
    v_email,
    v_phone,
    v_dob::text,
    v_address_line,
    v_employer,
    coalesce(v_income::text, '0'),
    coalesce(v_vehicle, '(not specified)'),
    case when v_consent_contact then 'yes' else 'no' end,
    case when v_consent_credit then 'yes' else 'no' end
  );

  v_comment_error := null;
  begin
    insert into public.crm_activities (
      customer_id,
      author_id,
      author_email,
      kind,
      body
    )
    values (
      v_customer_id,
      null,
      'Website Lead',
      'comment',
      v_comment_body
    );
  exception
    when others then
      v_comment_error := sqlerrm;
  end;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'system_lead_id', v_system_lead_id::text,
    'customer_id', v_customer_id::text,
    'preapproval_lead_id', v_preapproval_id::text,
    'comment_error', v_comment_error
  );
exception
  when unique_violation then
    select * into v_existing_lead
    from public.crm_system_leads
    where marketing_lead_id = v_marketing_id;
    if found then
      return jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'system_lead_id', v_existing_lead.id::text,
        'customer_id', v_existing_lead.customer_id::text,
        'preapproval_lead_id', v_existing_lead.preapproval_lead_id::text
      );
    end if;
    return jsonb_build_object('ok', false, 'error', sqlerrm);
  when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;

revoke all on function public.ingest_marketing_preapproval_lead(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_marketing_preapproval_lead(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Assign system lead (CRM staff)
-- ---------------------------------------------------------------------------

create or replace function public.assign_crm_system_lead(
  p_system_lead_id uuid,
  p_assigned_to uuid,
  p_assigned_to_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.crm_system_leads%rowtype;
  v_email text := nullif(trim(coalesce(p_assigned_to_email, '')), '');
begin
  if not public.user_has_crm_access() then
    return jsonb_build_object('ok', false, 'error', 'CRM access required.');
  end if;

  select * into v_lead
  from public.crm_system_leads
  where id = p_system_lead_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'System lead not found.');
  end if;

  if p_assigned_to is null then
    update public.crm_system_leads
    set assigned_to = null, assigned_to_email = null, assigned_at = null
    where id = p_system_lead_id;

    update public.crm_customers
    set assigned_to = null, assigned_to_email = null
    where id = v_lead.customer_id;

    return jsonb_build_object('ok', true);
  end if;

  if v_email is null then
    select u.email into v_email
    from auth.users u
    where u.id = p_assigned_to;
  end if;

  update public.crm_system_leads
  set
    assigned_to = p_assigned_to,
    assigned_to_email = v_email,
    assigned_at = now()
  where id = p_system_lead_id;

  update public.crm_customers
  set
    assigned_to = p_assigned_to,
    assigned_to_email = v_email
  where id = v_lead.customer_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.assign_crm_system_lead(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';
