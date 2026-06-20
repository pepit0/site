-- Optional phone on marketing preapproval_leads (run as postgres on **marketing** project).
-- Re-run sql/crm/crm_marketing_ingest_bridge.sql on the **CRM** project so ingest accepts
-- submitted applications without a phone number.
--
-- If submit still stores '' instead of NULL, re-run the submit_public_preapproval_lead
-- section from sql/marketing/26_preapproval_partial_queue.sql (updated for optional phone).

alter table public.preapproval_leads
  alter column phone drop not null;

update public.preapproval_leads
set phone = null
where trim(coalesce(phone, '')) = '';

notify pgrst, 'reload schema';
