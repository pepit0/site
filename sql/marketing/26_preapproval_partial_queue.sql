-- Partial pre-approval queue (30 min idle) + submit upgrade by marketing_lead_id.
-- Run on **marketing** Supabase as postgres after 25_preapproval_rpc_client_sync.sql.
--
-- pg_cron: enable Database → Extensions → pg_cron on the project, then run the schedule block
-- at the bottom (or create the job in Dashboard → Integrations → Cron).

-- ---------------------------------------------------------------------------
-- preapproval_leads: partial / snapshot columns
-- ---------------------------------------------------------------------------

alter table public.preapproval_leads
  add column if not exists application_status text not null default 'submitted';

alter table public.preapproval_leads
  drop constraint if exists preapproval_leads_application_status_check;

alter table public.preapproval_leads
  add constraint preapproval_leads_application_status_check
  check (application_status in ('partial', 'submitted'));

alter table public.preapproval_leads
  add column if not exists wizard_step integer;

alter table public.preapproval_leads
  add column if not exists wizard_snapshot jsonb;

alter table public.preapproval_leads
  add column if not exists erased_fields jsonb;

update public.preapproval_leads
set application_status = 'submitted'
where application_status is null
   or application_status not in ('partial', 'submitted');

-- ---------------------------------------------------------------------------
-- Queue (client upserts; cron promotes to preapproval_leads)
-- ---------------------------------------------------------------------------

create table if not exists public.preapproval_partial_queue (
  marketing_lead_id uuid primary key,
  deliver_after timestamptz not null,
  wizard_step integer not null default 0,
  wizard_snapshot jsonb not null default '{}'::jsonb,
  erased_fields jsonb not null default '{}'::jsonb,
  promoted_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists preapproval_partial_queue_deliver_idx
  on public.preapproval_partial_queue (deliver_after)
  where promoted_at is null;

alter table public.preapproval_partial_queue enable row level security;

-- Writes only via SECURITY DEFINER RPCs below.

-- ---------------------------------------------------------------------------
-- Helpers: read wizard_snapshot (camelCase from site)
-- ---------------------------------------------------------------------------

create or replace function public._preapproval_snapshot_text(p_snapshot jsonb, p_keys text[])
returns text
language sql
immutable
as $$
  select nullif(trim(coalesce(
    p_snapshot ->> p_keys[1],
    p_snapshot ->> p_keys[2],
    ''
  )), '');
$$;

create or replace function public._preapproval_snapshot_numeric(p_snapshot jsonb, p_keys text[])
returns numeric
language plpgsql
immutable
as $$
declare
  v_raw text;
begin
  v_raw := public._preapproval_snapshot_text(p_snapshot, p_keys);
  if v_raw is null then
    return null;
  end if;
  return v_raw::numeric;
exception
  when others then
    return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: upsert partial queue (anon)
-- ---------------------------------------------------------------------------

create or replace function public.upsert_preapproval_partial_queue(
  p_marketing_lead_id uuid,
  p_wizard_step integer,
  p_wizard_snapshot jsonb,
  p_erased_fields jsonb default '{}'::jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first text;
  v_last text;
  v_email text;
begin
  if p_marketing_lead_id is null then
    return json_build_object('ok', false, 'error', 'marketing_lead_id is required.', 'id', null);
  end if;

  v_first := public._preapproval_snapshot_text(p_wizard_snapshot, array['firstName', 'first_name']);
  v_last := public._preapproval_snapshot_text(p_wizard_snapshot, array['lastName', 'last_name']);
  v_email := lower(coalesce(public._preapproval_snapshot_text(p_wizard_snapshot, array['email', 'email']), ''));

  if length(trim(coalesce(v_first, ''))) < 1 then
    return json_build_object('ok', false, 'error', 'First name is required.', 'id', null);
  end if;
  if length(trim(coalesce(v_last, ''))) < 1 then
    return json_build_object('ok', false, 'error', 'Last name is required.', 'id', null);
  end if;
  if v_email !~ '^[^@]+@[^@]+\.[^@]+$' then
    return json_build_object('ok', false, 'error', 'Valid email is required.', 'id', null);
  end if;

  insert into public.preapproval_partial_queue (
    marketing_lead_id,
    deliver_after,
    wizard_step,
    wizard_snapshot,
    erased_fields,
    promoted_at,
    updated_at
  )
  values (
    p_marketing_lead_id,
    now() + interval '30 minutes',
    coalesce(p_wizard_step, 0),
    coalesce(p_wizard_snapshot, '{}'::jsonb),
    coalesce(p_erased_fields, '{}'::jsonb),
    null,
    now()
  )
  on conflict (marketing_lead_id) do update
  set
    deliver_after = now() + interval '30 minutes',
    wizard_step = excluded.wizard_step,
    wizard_snapshot = excluded.wizard_snapshot,
    erased_fields = excluded.erased_fields,
    promoted_at = null,
    updated_at = now();

  return json_build_object('ok', true, 'error', null, 'id', p_marketing_lead_id::text);
exception
  when others then
    return json_build_object('ok', false, 'error', sqlerrm, 'id', null);
end;
$$;

grant execute on function public.upsert_preapproval_partial_queue(uuid, integer, jsonb, jsonb)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: cancel / delete queue row
-- ---------------------------------------------------------------------------

create or replace function public.cancel_preapproval_partial_queue(p_marketing_lead_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_marketing_lead_id is null then
    return json_build_object('ok', true);
  end if;
  delete from public.preapproval_partial_queue where marketing_lead_id = p_marketing_lead_id;
  return json_build_object('ok', true);
exception
  when others then
    return json_build_object('ok', false, 'error', sqlerrm);
end;
$$;

grant execute on function public.cancel_preapproval_partial_queue(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Promote due partials → preapproval_leads (cron)
-- ---------------------------------------------------------------------------

create or replace function public.promote_due_preapproval_partials()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_snap jsonb;
  v_name text;
  v_email text;
  v_phone text;
  v_dob text;
  v_street text;
  v_city text;
  v_prov text;
  v_employer text;
  v_job_title text;
  v_vehicle text;
  v_income numeric;
  v_other_income numeric;
  v_other_desc text;
  v_budget int;
  v_employment text;
  v_employment_other text;
  v_employment_type text;
  v_income_tenure text;
  v_credit text;
  v_address_tenure text;
  v_sin text;
  v_count integer := 0;
begin
  for r in
    select *
    from public.preapproval_partial_queue q
    where q.deliver_after <= now()
      and q.promoted_at is null
    for update skip locked
  loop
    v_snap := coalesce(r.wizard_snapshot, '{}'::jsonb);

    v_name := trim(concat_ws(
      ' ',
      public._preapproval_snapshot_text(v_snap, array['firstName', 'first_name']),
      public._preapproval_snapshot_text(v_snap, array['lastName', 'last_name'])
    ));
    v_email := lower(coalesce(public._preapproval_snapshot_text(v_snap, array['email', 'email']), ''));
    v_phone := coalesce(public._preapproval_snapshot_text(v_snap, array['phone', 'phone']), '');
    v_dob := coalesce(public._preapproval_snapshot_text(v_snap, array['dob', 'date_of_birth']), '');
    v_street := coalesce(public._preapproval_snapshot_text(v_snap, array['street', 'street']), '');
    v_city := coalesce(public._preapproval_snapshot_text(v_snap, array['city', 'city']), '');
    v_prov := coalesce(public._preapproval_snapshot_text(v_snap, array['province', 'province']), '');
    v_employer := coalesce(public._preapproval_snapshot_text(v_snap, array['employer', 'employer']), '');
    v_job_title := public._preapproval_snapshot_text(v_snap, array['jobTitle', 'job_title']);
    v_vehicle := public._preapproval_snapshot_text(v_snap, array['vehicleInterest', 'vehicle_interest']);
    v_income := coalesce(public._preapproval_snapshot_numeric(v_snap, array['mainIncome', 'main_income']), 0);
    v_other_income := public._preapproval_snapshot_numeric(v_snap, array['otherIncome', 'other_income']);
    v_other_desc := public._preapproval_snapshot_text(v_snap, array['otherIncomeDescription', 'other_income_description']);
    v_budget := coalesce(
      (public._preapproval_snapshot_numeric(v_snap, array['monthlyBudgetCad', 'monthly_budget_cad']))::int,
      600
    );
    v_employment := coalesce(public._preapproval_snapshot_text(v_snap, array['employmentStatus', 'employment_status']), 'unknown');
    v_employment_other := public._preapproval_snapshot_text(v_snap, array['employmentOtherDescription', 'employment_other_description']);
    v_employment_type := public._preapproval_snapshot_text(v_snap, array['employmentType', 'employment_type']);
    v_income_tenure := coalesce(public._preapproval_snapshot_text(v_snap, array['incomeTenureBand', 'income_tenure']), 'unknown');
    v_credit := coalesce(public._preapproval_snapshot_text(v_snap, array['creditScoreBand', 'credit_score_band']), 'unknown');
    v_address_tenure := coalesce(public._preapproval_snapshot_text(v_snap, array['addressTenureBand', 'address_tenure']), 'unknown');
    v_sin := public._preapproval_snapshot_text(v_snap, array['sin', 'sin']);

    insert into public.preapproval_leads (
      id,
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
      employment_status,
      employment_other_description,
      employment_type,
      income_tenure,
      credit_score_band,
      address_tenure,
      sin,
      consent_contact,
      consent_credit,
      application_status,
      wizard_step,
      wizard_snapshot,
      erased_fields
    )
    values (
      r.marketing_lead_id,
      v_name,
      nullif(v_email, ''),
      v_phone,
      v_dob,
      v_street,
      nullif(public._preapproval_snapshot_text(v_snap, array['unit', 'line2']), ''),
      v_city,
      v_prov,
      v_employer,
      v_job_title,
      coalesce(v_income, 0),
      v_other_income,
      v_other_desc,
      v_vehicle,
      v_budget,
      false,
      v_employment,
      v_employment_other,
      v_employment_type,
      v_income_tenure,
      v_credit,
      v_address_tenure,
      v_sin,
      false,
      false,
      'partial',
      r.wizard_step,
      v_snap,
      coalesce(r.erased_fields, '{}'::jsonb)
    )
    on conflict (id) do update
    set
      display_name = excluded.display_name,
      email = excluded.email,
      phone = excluded.phone,
      date_of_birth = excluded.date_of_birth,
      street = excluded.street,
      line2 = excluded.line2,
      city = excluded.city,
      province = excluded.province,
      employer = excluded.employer,
      job_title = excluded.job_title,
      gross_monthly_income_cad = excluded.gross_monthly_income_cad,
      other_monthly_income_cad = excluded.other_monthly_income_cad,
      other_income_description = excluded.other_income_description,
      vehicle_interest = excluded.vehicle_interest,
      monthly_budget_cad = excluded.monthly_budget_cad,
      employment_status = excluded.employment_status,
      employment_other_description = excluded.employment_other_description,
      employment_type = excluded.employment_type,
      income_tenure = excluded.income_tenure,
      credit_score_band = excluded.credit_score_band,
      address_tenure = excluded.address_tenure,
      sin = excluded.sin,
      consent_contact = false,
      consent_credit = false,
      application_status = 'partial',
      wizard_step = excluded.wizard_step,
      wizard_snapshot = excluded.wizard_snapshot,
      erased_fields = excluded.erased_fields;

    update public.preapproval_partial_queue
    set promoted_at = now(), updated_at = now()
    where marketing_lead_id = r.marketing_lead_id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.promote_due_preapproval_partials() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- submit_public_preapproval_lead: optional p_marketing_lead_id (upgrade partial)
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'submit_public_preapproval_lead'
      and n.nspname = 'public'
  loop
    execute format('drop function %s cascade', r.fn);
  end loop;
end $$;

create function public.submit_public_preapproval_lead (
  p_display_name text,
  p_email text,
  p_phone text,
  p_date_of_birth text,
  p_street text,
  p_line2 text,
  p_city text,
  p_province text,
  p_employer text,
  p_job_title text,
  p_gross_monthly_income_cad numeric,
  p_other_monthly_income_cad numeric,
  p_other_income_description text,
  p_vehicle_interest text,
  p_monthly_budget_cad integer,
  p_has_trade boolean,
  p_trade_year text,
  p_trade_make text,
  p_trade_model text,
  p_trade_kms text,
  p_employment_status text,
  p_employment_other_description text,
  p_employment_type text,
  p_income_tenure text,
  p_credit_score_band text,
  p_address_tenure text,
  p_sin text,
  p_consent_contact boolean,
  p_consent_credit boolean,
  p_marketing_lead_id uuid default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  v_email text :=
    case
      when nullif(trim(coalesce(p_email, '')), '') is null then null
      else lower(trim(p_email))
    end;
begin
  if p_consent_contact is not true then
    return json_build_object(
      'ok',
      false,
      'error',
      'Consent to be contacted is required.',
      'id',
      null
    );
  end if;

  if p_marketing_lead_id is not null then
    new_id := p_marketing_lead_id;

    update public.preapproval_leads
    set
      display_name = trim(p_display_name),
      email = v_email,
      phone = trim(p_phone),
      date_of_birth = trim(p_date_of_birth),
      street = trim(p_street),
      line2 = nullif(trim(coalesce(p_line2, '')), ''),
      city = trim(p_city),
      province = trim(p_province),
      employer = trim(coalesce(p_employer, '')),
      job_title = nullif(trim(coalesce(p_job_title, '')), ''),
      gross_monthly_income_cad = p_gross_monthly_income_cad,
      other_monthly_income_cad = p_other_monthly_income_cad,
      other_income_description = nullif(trim(coalesce(p_other_income_description, '')), ''),
      vehicle_interest = nullif(trim(coalesce(p_vehicle_interest, '')), ''),
      monthly_budget_cad = p_monthly_budget_cad,
      has_trade = coalesce(p_has_trade, false),
      trade_year = nullif(trim(coalesce(p_trade_year, '')), ''),
      trade_make = nullif(trim(coalesce(p_trade_make, '')), ''),
      trade_model = nullif(trim(coalesce(p_trade_model, '')), ''),
      trade_kms = nullif(trim(coalesce(p_trade_kms, '')), ''),
      employment_status = trim(coalesce(p_employment_status, '')),
      employment_other_description = nullif(trim(coalesce(p_employment_other_description, '')), ''),
      employment_type = nullif(trim(coalesce(p_employment_type, '')), ''),
      income_tenure = trim(coalesce(p_income_tenure, '')),
      credit_score_band = trim(coalesce(p_credit_score_band, '')),
      address_tenure = trim(coalesce(p_address_tenure, '')),
      sin = nullif(trim(coalesce(p_sin, '')), ''),
      consent_contact = true,
      consent_credit = coalesce(p_consent_credit, false),
      application_status = 'submitted',
      wizard_step = null,
      wizard_snapshot = null,
      erased_fields = null
    where id = new_id;

    if not found then
      insert into public.preapproval_leads (
        id,
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
        sin,
        consent_contact,
        consent_credit,
        application_status
      )
      values (
        new_id,
        trim(p_display_name),
        v_email,
        trim(p_phone),
        trim(p_date_of_birth),
        trim(p_street),
        nullif(trim(coalesce(p_line2, '')), ''),
        trim(p_city),
        trim(p_province),
        trim(coalesce(p_employer, '')),
        nullif(trim(coalesce(p_job_title, '')), ''),
        p_gross_monthly_income_cad,
        p_other_monthly_income_cad,
        nullif(trim(coalesce(p_other_income_description, '')), ''),
        nullif(trim(coalesce(p_vehicle_interest, '')), ''),
        p_monthly_budget_cad,
        coalesce(p_has_trade, false),
        nullif(trim(coalesce(p_trade_year, '')), ''),
        nullif(trim(coalesce(p_trade_make, '')), ''),
        nullif(trim(coalesce(p_trade_model, '')), ''),
        nullif(trim(coalesce(p_trade_kms, '')), ''),
        trim(coalesce(p_employment_status, '')),
        nullif(trim(coalesce(p_employment_other_description, '')), ''),
        nullif(trim(coalesce(p_employment_type, '')), ''),
        trim(coalesce(p_income_tenure, '')),
        trim(coalesce(p_credit_score_band, '')),
        trim(coalesce(p_address_tenure, '')),
        nullif(trim(coalesce(p_sin, '')), ''),
        true,
        coalesce(p_consent_credit, false),
        'submitted'
      );
    end if;

    delete from public.preapproval_partial_queue where marketing_lead_id = new_id;

    return json_build_object('ok', true, 'error', null, 'id', new_id::text);
  end if;

  insert into public.preapproval_leads (
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
    sin,
    consent_contact,
    consent_credit,
    application_status
  )
  values (
    trim(p_display_name),
    v_email,
    trim(p_phone),
    trim(p_date_of_birth),
    trim(p_street),
    nullif(trim(coalesce(p_line2, '')), ''),
    trim(p_city),
    trim(p_province),
    trim(coalesce(p_employer, '')),
    nullif(trim(coalesce(p_job_title, '')), ''),
    p_gross_monthly_income_cad,
    p_other_monthly_income_cad,
    nullif(trim(coalesce(p_other_income_description, '')), ''),
    nullif(trim(coalesce(p_vehicle_interest, '')), ''),
    p_monthly_budget_cad,
    coalesce(p_has_trade, false),
    nullif(trim(coalesce(p_trade_year, '')), ''),
    nullif(trim(coalesce(p_trade_make, '')), ''),
    nullif(trim(coalesce(p_trade_model, '')), ''),
    nullif(trim(coalesce(p_trade_kms, '')), ''),
    trim(coalesce(p_employment_status, '')),
    nullif(trim(coalesce(p_employment_other_description, '')), ''),
    nullif(trim(coalesce(p_employment_type, '')), ''),
    trim(coalesce(p_income_tenure, '')),
    trim(coalesce(p_credit_score_band, '')),
    trim(coalesce(p_address_tenure, '')),
    nullif(trim(coalesce(p_sin, '')), ''),
    true,
    coalesce(p_consent_credit, false),
    'submitted'
  )
  returning id into new_id;

  return json_build_object('ok', true, 'error', null, 'id', new_id::text);
exception
  when others then
    return json_build_object('ok', false, 'error', sqlerrm, 'id', null);
end;
$$;

grant execute on function public.submit_public_preapproval_lead (
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  text,
  text,
  integer,
  boolean,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  uuid
) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- CRM webhook: INSERT + UPDATE
-- ---------------------------------------------------------------------------

create or replace function public.notify_preapproval_lead_to_crm()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  v_url text := 'https://izgehybhisycbhalkbub.supabase.co/functions/v1/ingest-marketing-preapproval';
  v_secret text := 'YOUR_WEBHOOK_SECRET';
  v_event_type text;
begin
  v_event_type := upper(tg_op);

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Marketing-Webhook-Secret', v_secret
    ),
    body := jsonb_build_object(
      'type', v_event_type,
      'table', tg_table_name,
      'schema', tg_table_schema,
      'record', to_jsonb(new),
      'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) else null::jsonb end
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

drop trigger if exists preapproval_to_crm_net on public.preapproval_leads;

create trigger preapproval_to_crm_net
  after insert or update on public.preapproval_leads
  for each row
  execute function public.notify_preapproval_lead_to_crm();

-- ---------------------------------------------------------------------------
-- pg_cron (optional — enable extension first)
-- ---------------------------------------------------------------------------

-- create extension if not exists pg_cron with schema pg_catalog;
--
-- select cron.unschedule(jobid)
-- from cron.job
-- where jobname = 'promote-preapproval-partials';
--
-- select cron.schedule(
--   'promote-preapproval-partials',
--   '*/3 * * * *',
--   $$ select public.promote_due_preapproval_partials(); $$
-- );

notify pgrst, 'reload schema';
