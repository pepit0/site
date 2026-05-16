-- Repair: ensure exactly ONE submit_public_preapproval_lead (27-arg) exists on marketing.
-- Use if PostgREST reports: "Could not find the function public.submit_public_preapproval_lead(...)"
-- Causes: migration 12 not applied, or old overload still present (CREATE OR REPLACE does not
-- remove functions with a different argument list unless DROP matches).
-- Prerequisite: run 12_preapproval_extended_application_fields.sql first so preapproval_leads
-- has the extended columns; otherwise the INSERT in this function will fail.
-- Run in Supabase SQL Editor as postgres on the **marketing** project, then
-- Dashboard → Settings → API → "Reload schema" (or wait for NOTIFY below).

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
  p_credit_score_band text,
  p_address_tenure text,
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
    credit_score_band,
    address_tenure,
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
    trim(coalesce(p_credit_score_band, '')),
    trim(coalesce(p_address_tenure, '')),
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
  boolean,
  boolean
) to anon, authenticated;

notify pgrst, 'reload schema';
