-- Repair after 26 failed at GRANT (wrong arg count dropped the old RPC).
-- Run on marketing Supabase as postgres. Safe if 26 partially applied.
--
-- Symptom: function submit_public_preapproval_lead(..., uuid) does not exist
-- Cause: GRANT listed 31 parameter types; function has 30.

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

-- Recreate from 26 (same body). If this block errors, run 25 first for income_tenure column.
create or replace function public.submit_public_preapproval_lead (
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

notify pgrst, 'reload schema';
