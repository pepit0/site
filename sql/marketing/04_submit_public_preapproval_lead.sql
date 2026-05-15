-- Public pre-approval submissions (marketing site → Supabase RPC used by the app).
-- Run in Supabase SQL Editor on the **marketing** project (role: postgres).
-- Creates table `preapproval_leads` + RPC `submit_public_preapproval_lead` matching
-- src/lib/submitPublicPreapprovalLead.ts (parameter names and JSON return shape).

create table if not exists public.preapproval_leads (
  id uuid primary key default gen_random_uuid (),
  display_name text not null,
  email text not null,
  phone text not null,
  date_of_birth text not null,
  street text not null,
  line2 text,
  city text not null,
  province text not null,
  employer text not null,
  gross_monthly_income_cad numeric(12, 2) not null,
  vehicle_interest text,
  consent_contact boolean not null,
  consent_credit boolean not null,
  created_at timestamptz not null default now ()
);

create index if not exists preapproval_leads_created_at_idx on public.preapproval_leads (created_at desc);

alter table public.preapproval_leads enable row level security;

-- No policies: rows are written only via SECURITY DEFINER RPC below (anon cannot SELECT/INSERT directly).

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
  p_gross_monthly_income_cad numeric,
  p_vehicle_interest text,
  p_consent_contact boolean,
  p_consent_credit boolean
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if p_consent_contact is not true or p_consent_credit is not true then
    return json_build_object(
      'ok',
      false,
      'error',
      'Consents are required.',
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
    gross_monthly_income_cad,
    vehicle_interest,
    consent_contact,
    consent_credit
  )
  values (
    trim(p_display_name),
    lower(trim(p_email)),
    trim(p_phone),
    trim(p_date_of_birth),
    trim(p_street),
    nullif(trim(coalesce(p_line2, '')), ''),
    trim(p_city),
    trim(p_province),
    trim(p_employer),
    p_gross_monthly_income_cad,
    nullif(trim(coalesce(p_vehicle_interest, '')), ''),
    p_consent_contact,
    p_consent_credit
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
  numeric,
  text,
  boolean,
  boolean
) to anon, authenticated;
