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

-- Allow phone-only leads when marketing email is optional.
alter table public.crm_public_preapproval_leads
  alter column email drop not null;

alter table public.crm_customers
  alter column email drop not null;

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

-- Extended fields (mirror marketing public.preapproval_leads). Table editor / reports read these;
-- crm_system_leads stays a thin link table (marketing_lead_id, preapproval_lead_id, customer_id, assignee).
alter table public.crm_public_preapproval_leads
  add column if not exists job_title text;

alter table public.crm_public_preapproval_leads
  add column if not exists other_monthly_income_cad numeric(12, 2);

alter table public.crm_public_preapproval_leads
  add column if not exists other_income_description text;

alter table public.crm_public_preapproval_leads
  add column if not exists monthly_budget_cad integer;

alter table public.crm_public_preapproval_leads
  add column if not exists has_trade boolean not null default false;

alter table public.crm_public_preapproval_leads
  add column if not exists trade_year text;

alter table public.crm_public_preapproval_leads
  add column if not exists trade_make text;

alter table public.crm_public_preapproval_leads
  add column if not exists trade_model text;

alter table public.crm_public_preapproval_leads
  add column if not exists trade_kms text;

alter table public.crm_public_preapproval_leads
  add column if not exists employment_status text;

alter table public.crm_public_preapproval_leads
  add column if not exists employment_other_description text;

alter table public.crm_public_preapproval_leads
  add column if not exists employment_type text;

alter table public.crm_public_preapproval_leads
  add column if not exists credit_score_band text;

alter table public.crm_public_preapproval_leads
  add column if not exists address_tenure text;

-- Full row as received (snake_case / camelCase normalized in RPC before insert); useful if columns lag marketing.
alter table public.crm_public_preapproval_leads
  add column if not exists marketing_snapshot jsonb;

alter table public.crm_public_preapproval_leads
  add column if not exists application_status text not null default 'submitted';

alter table public.crm_public_preapproval_leads
  add column if not exists wizard_step integer;

alter table public.crm_public_preapproval_leads
  add column if not exists erased_fields jsonb;

alter table public.crm_public_preapproval_leads
  add column if not exists income_tenure text;

alter table public.crm_public_preapproval_leads
  alter column phone drop not null;

alter table public.crm_public_preapproval_leads
  alter column date_of_birth drop not null;

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
  v_row jsonb;
  v_marketing_id uuid;
  v_name text;
  v_email_raw text;
  v_email text;
  v_phone text;
  v_dob_text text;
  v_dob date;
  v_street text;
  v_line2 text;
  v_city text;
  v_prov text;
  v_employer text;
  v_job_title text;
  v_vehicle text;
  v_income numeric;
  v_other_income numeric;
  v_other_income_desc text;
  v_monthly_budget int;
  v_has_trade boolean;
  v_trade_year text;
  v_trade_make text;
  v_trade_model text;
  v_trade_kms text;
  v_employment_status text;
  v_employment_other text;
  v_employment_type text;
  v_credit_band text;
  v_address_tenure text;
  v_income_tenure text;
  v_application_status text;
  v_is_partial boolean;
  v_wizard_step integer;
  v_erased_fields jsonb;
  v_erased_block text;
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
  v_employment_label text;
  v_credit_label text;
  v_tenure_label text;
  v_budget_label text;
  v_trade_block text;
  v_employment_type_display text;
  v_outer jsonb;
  v_row_parent jsonb;
  v_root_scalars jsonb;
  v_parent_scalars jsonb;
  v_duplicate boolean := false;
  v_old_application_status text;
  v_upgraded_to_submitted boolean := false;
begin
  -- Unwrap transport envelopes (Edge / queues often send { "message": <webhook json> }).
  v_outer := p_payload;

  if p_payload ? 'message' then
    if jsonb_typeof(p_payload -> 'message') = 'object' then
      v_outer := p_payload -> 'message';
    elsif jsonb_typeof(p_payload -> 'message') = 'string' then
      begin
        v_outer := (p_payload ->> 'message')::jsonb;
      exception
        when others then
          v_outer := p_payload;
      end;
    end if;
  end if;

  -- pg_net / HTTP workers sometimes POST { "body": "<stringified JSON>" } without a top-level `record`.
  if jsonb_typeof(v_outer) = 'object'
    and v_outer ? 'body'
    and jsonb_typeof(v_outer -> 'body') = 'string'
    and not (v_outer ? 'record')
    and length(trim(v_outer ->> 'body')) > 1 then
    begin
      v_outer := (v_outer ->> 'body')::jsonb;
    exception
      when others then
        null;
    end;
  end if;

  -- Resolve the inserted row. Track v_row_parent when we peel `.record` so we can merge sibling scalars.
  v_row := '{}'::jsonb;
  v_row_parent := null;

  if v_outer ? 'data'
    and jsonb_typeof(v_outer -> 'data') = 'object'
    and (v_outer -> 'data') ? 'record'
    and jsonb_typeof((v_outer -> 'data') -> 'record') = 'object' then
    v_row_parent := v_outer -> 'data';
    v_row := v_row_parent -> 'record';
  elsif v_outer ? 'body'
    and jsonb_typeof(v_outer -> 'body') = 'object'
    and (v_outer -> 'body') ? 'record'
    and jsonb_typeof((v_outer -> 'body') -> 'record') = 'object' then
    v_row_parent := v_outer -> 'body';
    v_row := v_row_parent -> 'record';
  elsif v_outer ? 'payload'
    and jsonb_typeof(v_outer -> 'payload') = 'object'
    and (v_outer -> 'payload') ? 'record'
    and jsonb_typeof((v_outer -> 'payload') -> 'record') = 'object' then
    v_row_parent := v_outer -> 'payload';
    v_row := v_row_parent -> 'record';
  elsif v_outer ? 'record' and jsonb_typeof(v_outer -> 'record') = 'object' then
    v_row_parent := v_outer;
    v_row := v_outer -> 'record';
  elsif v_outer ? 'record' and jsonb_typeof(v_outer -> 'record') = 'string' then
    v_row_parent := v_outer;
    begin
      v_row := (v_outer ->> 'record')::jsonb;
    exception
      when others then
        v_row := '{}'::jsonb;
    end;
  else
    v_row := v_outer;
    v_row_parent := null;
  end if;

  if jsonb_typeof(v_row) <> 'object' then
    v_row := '{}'::jsonb;
  end if;

  -- Proxies may nest the row again under record / data / new.
  if v_row ? 'record' and jsonb_typeof(v_row -> 'record') = 'object' and (v_row -> 'record') ? 'id' then
    v_row := v_row -> 'record';
  end if;
  if v_row ? 'data' and jsonb_typeof(v_row -> 'data') = 'object' and (v_row -> 'data') ? 'id' then
    v_row := v_row -> 'data';
  end if;
  if v_row ? 'new' and jsonb_typeof(v_row -> 'new') = 'object' and (v_row -> 'new') ? 'id' then
    v_row := v_row -> 'new';
  end if;

  -- Mis-proxied webhooks: only `record.id` inside `record`, while real columns sit as siblings of `record`
  -- or on the envelope root. Merge order: root scalars || parent scalars || row (row wins on key clashes).
  if jsonb_typeof(v_outer) = 'object' then
    select coalesce(
      jsonb_object_agg(k, v) filter (
        where k not in (
          'type', 'table', 'schema', 'record', 'old_record',
          'data', 'body', 'payload', 'message', 'headers', 'meta', 'event'
        )
          and jsonb_typeof(v) in ('string', 'number', 'boolean')
      ),
      '{}'::jsonb
    ) into v_root_scalars
    from jsonb_each(v_outer) t(k, v);
  else
    v_root_scalars := '{}'::jsonb;
  end if;

  if v_row_parent is not null and jsonb_typeof(v_row_parent) = 'object' then
    select coalesce(
      jsonb_object_agg(k, v) filter (
        where k not in ('record', 'old_record')
          and jsonb_typeof(v) in ('string', 'number', 'boolean')
      ),
      '{}'::jsonb
    ) into v_parent_scalars
    from jsonb_each(v_row_parent) t(k, v);
  else
    v_parent_scalars := '{}'::jsonb;
  end if;

  v_row := coalesce(v_root_scalars, '{}'::jsonb) || coalesce(v_parent_scalars, '{}'::jsonb) || v_row;

  -- Do NOT merge v_row->'application' into the row: partial objects can overwrite real fields with null.

  v_marketing_id := nullif(trim(coalesce(
    v_row ->> 'marketing_lead_id',
    v_row ->> 'marketingLeadId',
    v_row ->> 'id'
  , '')), '')::uuid;
  if v_marketing_id is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'Marketing lead id is required (RECORD.id or marketing_lead_id).'
    );
  end if;

  select * into v_existing_lead
  from public.crm_system_leads
  where marketing_lead_id = v_marketing_id;

  if found then
    v_duplicate := true;
  end if;

  v_name := trim(coalesce(v_row ->> 'display_name', v_row ->> 'displayName', ''));
  v_email_raw := trim(coalesce(v_row ->> 'email', ''));
  v_email :=
    case
      when length(v_email_raw) = 0 then null
      else lower(v_email_raw)
    end;
  v_phone := regexp_replace(coalesce(v_row ->> 'phone', ''), '\D', '', 'g');
  v_dob_text := trim(coalesce(v_row ->> 'date_of_birth', v_row ->> 'dateOfBirth', ''));
  v_street := trim(coalesce(v_row ->> 'street', ''));
  v_line2 := nullif(
    trim(coalesce(v_row ->> 'line2', v_row ->> 'address_line2', v_row ->> 'addressLine2', '')),
    ''
  );
  v_city := trim(coalesce(v_row ->> 'city', ''));
  v_prov := trim(coalesce(v_row ->> 'province', ''));
  v_employer := trim(coalesce(v_row ->> 'employer', ''));
  v_job_title := nullif(trim(coalesce(v_row ->> 'job_title', v_row ->> 'jobTitle', '')), '');
  v_vehicle := nullif(trim(coalesce(v_row ->> 'vehicle_interest', v_row ->> 'vehicleInterest', '')), '');

  begin
    v_income := null;
    if (v_row -> 'gross_monthly_income_cad') is not null
      and jsonb_typeof(v_row -> 'gross_monthly_income_cad') = 'number' then
      v_income := (v_row -> 'gross_monthly_income_cad')::numeric;
    elsif (v_row -> 'grossMonthlyIncomeCad') is not null
      and jsonb_typeof(v_row -> 'grossMonthlyIncomeCad') = 'number' then
      v_income := (v_row -> 'grossMonthlyIncomeCad')::numeric;
    else
      v_income := nullif(
        trim(coalesce(v_row ->> 'gross_monthly_income_cad', v_row ->> 'grossMonthlyIncomeCad', '')),
        ''
      )::numeric;
    end if;
  exception
    when others then
      v_income := null;
  end;

  begin
    v_other_income := null;
    if (v_row -> 'other_monthly_income_cad') is not null
      and jsonb_typeof(v_row -> 'other_monthly_income_cad') = 'number' then
      v_other_income := (v_row -> 'other_monthly_income_cad')::numeric;
    elsif (v_row -> 'otherMonthlyIncomeCad') is not null
      and jsonb_typeof(v_row -> 'otherMonthlyIncomeCad') = 'number' then
      v_other_income := (v_row -> 'otherMonthlyIncomeCad')::numeric;
    else
      v_other_income := nullif(
        trim(coalesce(v_row ->> 'other_monthly_income_cad', v_row ->> 'otherMonthlyIncomeCad', '')),
        ''
      )::numeric;
    end if;
  exception
    when others then
      v_other_income := null;
  end;

  v_other_income_desc := nullif(
    trim(coalesce(v_row ->> 'other_income_description', v_row ->> 'otherIncomeDescription', '')),
    ''
  );

  begin
    v_monthly_budget := 0;
    if (v_row -> 'monthly_budget_cad') is not null
      and jsonb_typeof(v_row -> 'monthly_budget_cad') = 'number' then
      v_monthly_budget := round((v_row -> 'monthly_budget_cad')::numeric)::int;
    elsif (v_row -> 'monthlyBudgetCad') is not null
      and jsonb_typeof(v_row -> 'monthlyBudgetCad') = 'number' then
      v_monthly_budget := round((v_row -> 'monthlyBudgetCad')::numeric)::int;
    else
      v_monthly_budget := coalesce(
        nullif(trim(coalesce(v_row ->> 'monthly_budget_cad', v_row ->> 'monthlyBudgetCad', '')), '')::int,
        0
      );
    end if;
  exception
    when others then
      v_monthly_budget := 0;
  end;

  v_has_trade :=
    case
      when (v_row -> 'has_trade') = 'true'::jsonb or (v_row -> 'hasTrade') = 'true'::jsonb then true
      when (v_row -> 'has_trade') = 'false'::jsonb or (v_row -> 'hasTrade') = 'false'::jsonb then false
      else lower(trim(coalesce(v_row ->> 'has_trade', v_row ->> 'hasTrade', ''))) in ('true', 't', '1', 'yes')
    end;

  v_trade_year := nullif(trim(coalesce(v_row ->> 'trade_year', v_row ->> 'tradeYear', '')), '');
  v_trade_make := nullif(trim(coalesce(v_row ->> 'trade_make', v_row ->> 'tradeMake', '')), '');
  v_trade_model := nullif(trim(coalesce(v_row ->> 'trade_model', v_row ->> 'tradeModel', '')), '');
  v_trade_kms := nullif(trim(coalesce(v_row ->> 'trade_kms', v_row ->> 'tradeKms', '')), '');
  v_employment_status := nullif(
    trim(coalesce(v_row ->> 'employment_status', v_row ->> 'employmentStatus', '')),
    ''
  );
  v_employment_other := nullif(
    trim(coalesce(
      v_row ->> 'employment_other_description',
      v_row ->> 'employmentOtherDescription',
      ''
    )),
    ''
  );
  v_employment_type := nullif(
    trim(coalesce(v_row ->> 'employment_type', v_row ->> 'employmentType', '')),
    ''
  );
  v_credit_band := nullif(
    trim(coalesce(v_row ->> 'credit_score_band', v_row ->> 'creditScoreBand', '')),
    ''
  );
  v_address_tenure := nullif(
    trim(coalesce(v_row ->> 'address_tenure', v_row ->> 'addressTenure', '')),
    ''
  );

  v_income_tenure := nullif(
    trim(coalesce(v_row ->> 'income_tenure', v_row ->> 'incomeTenure', '')),
    ''
  );

  v_application_status := lower(trim(coalesce(v_row ->> 'application_status', v_row ->> 'applicationStatus', 'submitted')));
  v_is_partial := v_application_status = 'partial';

  begin
    v_wizard_step := nullif(trim(coalesce(v_row ->> 'wizard_step', v_row ->> 'wizardStep', '')), '')::integer;
  exception
    when others then
      v_wizard_step := null;
  end;

  v_erased_fields :=
    case
      when jsonb_typeof(v_row -> 'erased_fields') = 'object' then v_row -> 'erased_fields'
      when jsonb_typeof(v_row -> 'erasedFields') = 'object' then v_row -> 'erasedFields'
      else '{}'::jsonb
    end;

  v_application_status := lower(trim(coalesce(v_row ->> 'application_status', v_row ->> 'applicationStatus', '')));

  -- In-progress rows: do not default to submitted (that would require consent_contact).
  if v_application_status not in ('partial', 'submitted') then
    if jsonb_typeof(v_row -> 'wizard_snapshot') = 'object'
       and coalesce(v_row -> 'wizard_snapshot', '{}'::jsonb) <> '{}'::jsonb then
      v_application_status := 'partial';
    elsif jsonb_typeof(v_row -> 'wizardSnapshot') = 'object'
       and coalesce(v_row -> 'wizardSnapshot', '{}'::jsonb) <> '{}'::jsonb then
      v_application_status := 'partial';
    elsif v_wizard_step is not null then
      v_application_status := 'partial';
    else
      v_application_status := 'submitted';
    end if;
  end if;

  v_is_partial := v_application_status = 'partial';

  v_erased_block := '';
  if v_is_partial and v_erased_fields <> '{}'::jsonb then
    select string_agg(
      format(
        '  %s: %s (erased)',
        initcap(replace(k, '_', ' ')),
        trim(both '"' from v::text)
      ),
      E'\n'
      order by k
    )
    into v_erased_block
    from jsonb_each_text(v_erased_fields) t(k, v)
    where length(trim(v)) > 0;
  end if;

  v_consent_contact :=
    case
      when (v_row -> 'consent_contact') = 'true'::jsonb or (v_row -> 'consentContact') = 'true'::jsonb then true
      when (v_row -> 'consent_contact') = 'false'::jsonb or (v_row -> 'consentContact') = 'false'::jsonb then false
      else lower(trim(coalesce(v_row ->> 'consent_contact', v_row ->> 'consentContact', ''))) in ('true', 't', '1', 'yes')
    end;
  v_consent_credit :=
    case
      when (v_row -> 'consent_credit') = 'true'::jsonb or (v_row -> 'consentCredit') = 'true'::jsonb then true
      when (v_row -> 'consent_credit') = 'false'::jsonb or (v_row -> 'consentCredit') = 'false'::jsonb then false
      else lower(trim(coalesce(v_row ->> 'consent_credit', v_row ->> 'consentCredit', ''))) in ('true', 't', '1', 'yes')
    end;

  if not v_is_partial and v_consent_contact is not true then
    return jsonb_build_object('ok', false, 'error', 'Consent to be contacted is required.');
  end if;

  if length(v_name) < 2 then
    return jsonb_build_object('ok', false, 'error', 'display_name is required.');
  end if;

  if v_is_partial then
    if v_email is null or v_email !~ '^[^@]+@[^@]+\.[^@]+$' then
      return jsonb_build_object('ok', false, 'error', 'Valid email is required for partial applications.');
    end if;
  elsif v_email is not null and v_email !~ '^[^@]+@[^@]+\.[^@]+$' then
    return jsonb_build_object('ok', false, 'error', 'Valid email is required when provided.');
  end if;

  if length(v_phone) = 11 and left(v_phone, 1) = '1' then
    v_phone := substr(v_phone, 2);
  end if;

  if v_is_partial then
    if length(v_phone) > 0 and length(v_phone) <> 10 then
      return jsonb_build_object('ok', false, 'error', 'Phone must be 10 digits when provided.');
    end if;
    if length(v_phone) = 0 then
      v_phone := null;
    end if;
  elsif length(v_phone) <> 10 then
    return jsonb_build_object('ok', false, 'error', 'Valid 10-digit phone is required.');
  end if;

  if v_is_partial and length(v_dob_text) = 0 then
    v_dob := null;
  else
    begin
      v_dob := v_dob_text::date;
    exception
      when others then
        return jsonb_build_object('ok', false, 'error', 'Invalid date_of_birth.');
    end;

    if v_dob > current_date or v_dob < (current_date - interval '120 years') then
      return jsonb_build_object('ok', false, 'error', 'Invalid date_of_birth.');
    end if;
  end if;

  v_budget_label :=
    case
      when v_monthly_budget = 199 then 'Less than $200/month'
      when v_monthly_budget = 1001 then '$1000+/month'
      when coalesce(v_monthly_budget, 0) = 0 then '(not specified)'
      else format('$%s/month', v_monthly_budget)
    end;

  v_employment_label :=
    case coalesce(v_employment_status, '')
      when 'employed' then 'Employed'
      when 'unemployed' then 'Unemployed'
      when 'retired_pension' then 'Retired / pension'
      when 'disability_pension' then 'Disability / pension'
      when 'aish' then 'AISH'
      when 'self_employed' then 'Self-employed'
      when 'student' then 'Student'
      when 'spousal_income' then 'Spousal income'
      when 'other' then 'Other'
      else coalesce(nullif(trim(v_employment_status), ''), '(not specified)')
    end;

  v_credit_label :=
    case coalesce(v_credit_band, '')
      when 'excellent_750_plus' then 'Excellent (750+)'
      when 'great_670_750' then 'Great (670-750)'
      when 'good_620_670' then 'Good (620-670)'
      when 'decent_550_619' then 'Decent (550-619)'
      when 'poor_300_549' then 'Poor (300-549)'
      else coalesce(nullif(trim(v_credit_band), ''), '(not specified)')
    end;

  v_tenure_label :=
    case coalesce(v_address_tenure, '')
      when 'under_1_year' then 'Under 1 year at this address'
      when '1_to_2_years' then '1-2 years at this address'
      when '3_to_5_years' then '3-5 years at this address'
      when 'over_5_years' then '5+ years at this address'
      when 'prefer_not_to_say' then 'Prefer not to say'
      else coalesce(nullif(trim(v_address_tenure), ''), '(not specified)')
    end;

  v_employment_type_display :=
    case coalesce(v_employment_type, '')
      when 'full_time' then 'Full-time'
      when 'part_time' then 'Part-time'
      else coalesce(nullif(trim(v_employment_type), ''), '(n/a)')
    end;

  if v_has_trade then
    v_trade_block := format(
      E'Trade-in: Yes\n'
        || E'  Year: %s\n'
        || E'  Make: %s\n'
        || E'  Model: %s\n'
        || E'  Odometer (km): %s',
      coalesce(v_trade_year, '(blank)'),
      coalesce(v_trade_make, '(blank)'),
      coalesce(v_trade_model, '(blank)'),
      coalesce(v_trade_kms, '(blank)')
    );
  else
    v_trade_block := E'Trade-in: No (trade details left blank)';
  end if;

  v_metadata := jsonb_strip_nulls(jsonb_build_object(
    'source', 'marketing',
    'creator_display', 'System - Website app',
    'marketing_lead_id', v_marketing_id::text,
    'street', v_street,
    'line2', v_line2,
    'city', v_city,
    'province', v_prov,
    'employer', v_employer,
    'job_title', v_job_title,
    'gross_monthly_income_cad', v_income,
    'other_monthly_income_cad', v_other_income,
    'other_income_description', v_other_income_desc,
    'vehicle_interest', v_vehicle,
    'monthly_budget_cad', nullif(v_monthly_budget, 0),
    'has_trade', v_has_trade,
    'trade_year', v_trade_year,
    'trade_make', v_trade_make,
    'trade_model', v_trade_model,
    'trade_kms', v_trade_kms,
    'employment_status', v_employment_status,
    'employment_other_description', v_employment_other,
    'employment_type', v_employment_type,
    'credit_score_band', v_credit_band,
    'address_tenure', v_address_tenure,
    'income_tenure', v_income_tenure,
    'application_status', v_application_status
  ));

  if not v_duplicate then
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
      job_title,
      gross_monthly_income_cad,
      other_monthly_income_cad,
      other_income_description,
      vehicle_interest,
      monthly_budget_cad,
      has_trade,
      trade_year,
      trade_make,
      trade_model,
      trade_kms,
      employment_status,
      employment_other_description,
      employment_type,
      income_tenure,
      credit_score_band,
      address_tenure,
      consent_contact,
      consent_credit,
      application_status,
      wizard_step,
      erased_fields,
      marketing_snapshot
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
      v_job_title,
      coalesce(v_income, 0),
      v_other_income,
      v_other_income_desc,
      v_vehicle,
      v_monthly_budget,
      v_has_trade,
      v_trade_year,
      v_trade_make,
      v_trade_model,
      v_trade_kms,
      v_employment_status,
      v_employment_other,
      v_employment_type,
      v_income_tenure,
      v_credit_band,
      v_address_tenure,
      v_consent_contact,
      v_consent_credit,
      v_application_status,
      v_wizard_step,
      case when v_erased_fields = '{}'::jsonb then null else v_erased_fields end,
      v_row
    )
    returning id into v_preapproval_id;

    if v_email is not null then
      select c.id into v_customer_id
      from public.crm_customers c
      where lower(coalesce(c.email, '')) = v_email
      limit 1;
    end if;

    if v_customer_id is null and v_phone is not null then
      select c.id into v_customer_id
      from public.crm_customers c
      where regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = v_phone
      limit 1;
    end if;

    if v_customer_id is null then
      insert into public.crm_customers (
        created_by,
        created_by_email,
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
        'System - Website app',
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
      case
        when v_is_partial then 'New partial pre-approval'
        else 'New system lead'
      end,
      case
        when v_is_partial then
          v_name
          || ' started a pre-approval on the marketing site (partial'
          || coalesce(', step ' || (v_wizard_step + 1)::text, '')
          || ').'
        else v_name || ' submitted a credit pre-approval on the marketing site.'
      end,
      v_system_lead_id,
      v_customer_id
    from (
      select d.user_id from public.crm_user_directory d
      union
      select u.id as user_id
      from auth.users u
      inner join public.crm_access_allowlist a on lower(u.email) = lower(a.email)
    ) notify_user;
  else
    v_preapproval_id := v_existing_lead.preapproval_lead_id;
    v_customer_id := v_existing_lead.customer_id;
    v_system_lead_id := v_existing_lead.id;

    select p.application_status
    into v_old_application_status
    from public.crm_public_preapproval_leads p
    where p.id = v_preapproval_id;

    update public.crm_public_preapproval_leads p
    set
      display_name = v_name,
      email = v_email,
      phone = v_phone,
      date_of_birth = v_dob,
      street = v_street,
      line2 = v_line2,
      city = v_city,
      province = v_prov,
      employer = v_employer,
      job_title = v_job_title,
      gross_monthly_income_cad = coalesce(v_income, 0),
      other_monthly_income_cad = v_other_income,
      other_income_description = v_other_income_desc,
      vehicle_interest = v_vehicle,
      monthly_budget_cad = v_monthly_budget,
      has_trade = v_has_trade,
      trade_year = v_trade_year,
      trade_make = v_trade_make,
      trade_model = v_trade_model,
      trade_kms = v_trade_kms,
      employment_status = v_employment_status,
      employment_other_description = v_employment_other,
      employment_type = v_employment_type,
      income_tenure = v_income_tenure,
      credit_score_band = v_credit_band,
      address_tenure = v_address_tenure,
      consent_contact = v_consent_contact,
      consent_credit = v_consent_credit,
      application_status = v_application_status,
      wizard_step = v_wizard_step,
      erased_fields = case when v_erased_fields = '{}'::jsonb then null else v_erased_fields end,
      marketing_snapshot = v_row
    where p.id = v_preapproval_id;

    update public.crm_customers c
    set
      display_name = coalesce(nullif(trim(c.display_name), ''), v_name),
      email = coalesce(c.email, v_email),
      phone = coalesce(nullif(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), ''), v_phone),
      date_of_birth = coalesce(c.date_of_birth, v_dob),
      profile_metadata = coalesce(c.profile_metadata, '{}'::jsonb) || v_metadata
    where c.id = v_customer_id;

    v_upgraded_to_submitted :=
      coalesce(v_old_application_status, '') = 'partial'
      and v_application_status = 'submitted';
  end if;

  v_address_line := v_street;
  if v_line2 is not null and length(v_line2) > 0 then
    v_address_line := v_address_line || ', ' || v_line2;
  end if;
  v_address_line := v_address_line || ', ' || v_city || ', ' || v_prov;

  v_comment_body :=
    case
      when v_is_partial then
        E'Website pre-approval — PARTIAL (in progress)\n\n'
      else
        E'Website pre-approval application (submitted on the marketing site)\n\n'
    end
    || E'--- Lead ---\n'
    || format(E'Marketing lead ID: %s\n', v_marketing_id::text)
    || format(E'Application status: %s\n', v_application_status)
    || case
      when v_wizard_step is not null then
        format(E'Wizard step (0-based): %s\n', v_wizard_step::text)
      else ''
    end
    || case
      when nullif(trim(coalesce(v_row ->> 'created_at', '')), '') is not null then
        format(E'Submitted at (marketing): %s\n', trim(v_row ->> 'created_at'))
      else ''
    end
    || E'\n--- Applicant ---\n'
    || format(E'Display name: %s\n', v_name)
    || format(E'Email: %s\n', coalesce(v_email, '(not provided)'))
    || format(E'Phone: %s\n', coalesce(v_phone, '(not provided)'))
    || format(
      E'Date of birth: %s\n',
      case when v_dob is null then '(not provided)' else v_dob::text end
    )
    || case
      when v_erased_block is not null and length(v_erased_block) > 0 then
        E'\n--- Previously entered (erased) ---\n' || v_erased_block || E'\n'
      else ''
    end
    || E'\n--- Address ---\n'
    || format(E'Street: %s\n', nullif(v_street, ''))
    || format(E'Unit / suite: %s\n', coalesce(v_line2, '(none)'))
    || format(E'City: %s\n', nullif(v_city, ''))
    || format(E'Province / territory: %s\n', nullif(v_prov, ''))
    || format(E'Full address (single line): %s\n', v_address_line)
    || format(E'Time at address: %s\n', v_tenure_label)
    || E'\n--- Financing preferences ---\n'
    || format(
      E'Vehicle / unit interest: %s\n',
      coalesce(nullif(v_vehicle, ''), '(not specified / not sure)')
    )
    || format(E'Estimated monthly payment budget: %s\n', v_budget_label)
    || format(E'Credit score (self-assessment): %s\n', v_credit_label)
    || E'\n--- Trade-in ---\n'
    || v_trade_block
    || E'\n\n--- Income and employment ---\n'
    || format(E'Employment / income status: %s\n', v_employment_label)
    || format(
      E'Status detail (e.g. other): %s\n',
      coalesce(nullif(v_employment_other, ''), '(n/a)')
    )
    || format(E'Full-time vs part-time: %s\n', v_employment_type_display)
    || format(
      E'Main monthly income (CAD): %s\n',
      coalesce(v_income::text, '(not parsed)')
    )
    || format(
      E'Other monthly income (CAD): %s\n',
      case
        when v_other_income is null then '(none / not provided)'
        else v_other_income::text
      end
    )
    || format(
      E'Other income description: %s\n',
      coalesce(nullif(v_other_income_desc, ''), '(n/a)')
    )
    || format(
      E'Employer / business name: %s\n',
      coalesce(nullif(trim(v_employer), ''), '(n/a)')
    )
    || format(
      E'Job title / role: %s\n',
      coalesce(v_job_title, '(n/a)')
    )
    || format(
      E'Income tenure: %s\n',
      coalesce(nullif(v_income_tenure, ''), '(not specified)')
    )
    || E'\n--- Consents ---\n'
    || format(E'Consent to be contacted: %s\n', case when v_consent_contact then 'yes' else 'no' end)
    || format(E'Consent for credit inquiry: %s\n', case when v_consent_credit then 'yes' else 'no' end)
    || E'\n--- Complete record (all columns from marketing) ---\n'
    || jsonb_pretty(v_row);

  v_comment_error := null;
  if not v_duplicate or v_upgraded_to_submitted then
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
        'System - Website app',
        'comment',
        v_comment_body
      );
    exception
      when others then
        v_comment_error := sqlerrm;
    end;
  end if;

  if v_upgraded_to_submitted then
    insert into public.crm_notifications (user_id, type, title, body, system_lead_id, customer_id)
    select distinct
      notify_user.user_id,
      'system_lead',
      'Pre-approval completed',
      v_name || ' completed their pre-approval application on the marketing site.',
      v_system_lead_id,
      v_customer_id
    from (
      select d.user_id from public.crm_user_directory d
      union
      select u.id as user_id
      from auth.users u
      inner join public.crm_access_allowlist a on lower(u.email) = lower(a.email)
    ) notify_user;
  end if;

  return jsonb_build_object(
    'ok', true,
    'duplicate', v_duplicate and not v_upgraded_to_submitted,
    'refreshed_existing', v_duplicate and not v_upgraded_to_submitted,
    'upgraded_to_submitted', v_upgraded_to_submitted,
    'application_status', v_application_status,
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
