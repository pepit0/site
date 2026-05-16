-- Marketing: diagnose + repair missing extended columns on preapproval_leads.
-- Run on the **marketing** Supabase project as postgres.
--
-- Symptom on CRM: activity comment / marketing_snapshot JSON only has basic fields
-- (name, address, employer, income, vehicle) but NOT monthly_budget_cad, employment_status,
-- credit_score_band, address_tenure, has_trade, job_title, etc.
--
-- Cause: migration 12 was never applied (table missing columns) OR submit_public_preapproval_lead
-- still INSERTs only legacy columns even though the function signature is 27-arg.

-- ---------------------------------------------------------------------------
-- 1) DIAGNOSE (read results in SQL editor)
-- ---------------------------------------------------------------------------

select column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'preapproval_leads'
order by ordinal_position;

-- Expect these extended columns (among others). If any are missing, run section 2 below.
--   monthly_budget_cad, has_trade, trade_year, trade_make, trade_model, trade_kms,
--   employment_status, employment_other_description, employment_type,
--   credit_score_band, address_tenure, job_title,
--   other_monthly_income_cad, other_income_description

select
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'preapproval_leads'
      and column_name = 'monthly_budget_cad'
  ) as has_monthly_budget_cad,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'preapproval_leads'
      and column_name = 'employment_status'
  ) as has_employment_status,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'preapproval_leads'
      and column_name = 'credit_score_band'
  ) as has_credit_score_band;

-- RPC body must mention monthly_budget_cad in the INSERT list:
select
  position('monthly_budget_cad' in p.prosrc) > 0 as rpc_inserts_monthly_budget,
  position('employment_status' in p.prosrc) > 0 as rpc_inserts_employment_status
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname = 'submit_public_preapproval_lead'
  and n.nspname = 'public';

-- Inspect one lead (replace id):
-- select id, monthly_budget_cad, employment_status, credit_score_band, address_tenure,
--        has_trade, job_title
-- from public.preapproval_leads
-- where id = '9ff6e68d-f1ad-4b0b-974a-2e604aa9e5e1';

-- ---------------------------------------------------------------------------
-- 2) REPAIR — same as 12_preapproval_extended_application_fields.sql (idempotent)
-- ---------------------------------------------------------------------------

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
-- 3) REPAIR RPC — re-run full body from 13 (drops all overloads, recreates 27-arg)
-- ---------------------------------------------------------------------------
-- After this file's ALTERs succeed, run in the same session or immediately after:
--   sql/marketing/13_submit_public_preapproval_lead_rpc_repair.sql
--
-- Then submit a NEW test lead and confirm marketing row has extended columns populated.

notify pgrst, 'reload schema';
