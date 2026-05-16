-- Marketing: compare what the DB row has vs what the trigger would POST.
-- Run after a test insert (replace id).

-- 1) Full row as stored
select *
from public.preapproval_leads
where id = '75841e56-5fe3-43ae-9c49-8bee7136d566';

-- 2) Exact JSON the trigger should send inside `record` (must include id + extended columns)
select jsonb_build_object(
  'type', 'INSERT',
  'table', 'preapproval_leads',
  'schema', 'public',
  'record', to_jsonb(p),
  'old_record', null::jsonb
) as expected_webhook_body
from public.preapproval_leads p
where id = '75841e56-5fe3-43ae-9c49-8bee7136d566';

-- 3) Confirm trigger function source uses to_jsonb(NEW), not a hand-built subset
select pg_get_functiondef(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname = 'notify_preapproval_lead_to_crm'
  and n.nspname = 'public';

-- If expected_webhook_body.record has monthly_budget_cad etc. but CRM comment does not,
-- the CRM Edge function is rewriting the body before calling ingest_marketing_preapproval_lead.
