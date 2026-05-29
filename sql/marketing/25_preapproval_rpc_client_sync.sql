-- Sync submit_public_preapproval_lead with the site client (29 named args).
--
-- Symptom (PostgREST / Supabase JS):
--   Could not find the function public.submit_public_preapproval_lead(
--     ..., p_income_tenure, ..., p_sin, ... ) in the schema cache
--
-- Cause: marketing DB still has the 27-arg RPC from 12/13 (no p_income_tenure, p_sin).
-- The app sends p_income_tenure and p_sin after wizard updates.
--
-- Run on the **marketing** Supabase project as postgres, then:
--   Dashboard → Settings → API → Reload schema
-- (or wait for NOTIFY pgrst below)

-- ---------------------------------------------------------------------------
-- Columns (idempotent)
-- ---------------------------------------------------------------------------

alter table public.preapproval_leads
  add column if not exists income_tenure text not null default 'unknown';

alter table public.preapproval_leads
  add column if not exists sin text;

-- Extended fields from 12 (safe if already applied)
alter table public.preapproval_leads
  add column if not exists monthly_budget_cad integer not null default 600;

alter table public.preapproval_leads
  add column if not exists has_trade boolean not null default false;

alter table public.preapproval_leads
  add column if not exists trade_year text;

alter table public.preapproval_leads
  add column if not exists trade_make text;

alter table public.preapproval_leads
  add column if not exists trade_model text;

alter table public.preapproval_leads
  add column if not exists trade_kms text;

alter table public.preapproval_leads
  add column if not exists employment_status text not null default 'unknown';

alter table public.preapproval_leads
  add column if not exists employment_other_description text;

alter table public.preapproval_leads
  add column if not exists employment_type text;

alter table public.preapproval_leads
  add column if not exists other_monthly_income_cad numeric(12, 2);

alter table public.preapproval_leads
  add column if not exists other_income_description text;

alter table public.preapproval_leads
  add column if not exists job_title text;

alter table public.preapproval_leads
  add column if not exists credit_score_band text not null default 'unknown';

alter table public.preapproval_leads
  add column if not exists address_tenure text not null default 'unknown';

alter table public.preapproval_leads
  alter column email drop not null;

-- ---------------------------------------------------------------------------
-- RPC: drop all overloads, recreate 29-arg (matches src/lib/submitPublicPreapprovalLead.ts)
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
  p_consent_credit boolean
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
    consent_credit
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
    coalesce(p_consent_credit, false)
  )
  returning id into new_id;

  return json_build_object('ok', true, 'error', null, 'id', new_id::text);
exception
  when others then
    return json_build_object('ok', false, 'error', sqlerrm, 'id', null);
end;
$$;

-- 23 text + 2 numeric + 1 integer + 3 boolean = 29 parameters
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
  boolean
) to anon, authenticated;

notify pgrst, 'reload schema';
