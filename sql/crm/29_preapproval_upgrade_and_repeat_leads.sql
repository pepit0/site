-- CRM: partial → submitted upgrade + repeat applications (postgres, RLS off).
--
-- Run the FULL file on the CRM project:
--   sql/crm/crm_marketing_ingest_bridge.sql
--
-- What changed (2025-05):
-- 1) Partial and full submit use different marketing_lead_id values (site passes null on
--    full submit), so a promoted partial stays in CRM and the completed app is a NEW lead.
-- 2) ingest still upgrades partial→submitted only when the SAME marketing_lead_id is
--    re-sent (e.g. webhook retry), not for intentional full submissions.
-- 3) Brand-new application (new marketing_lead_id, even same email as before):
--    - Always creates a NEW crm_system_leads row (unchanged behavior)
--    - duplicate=true only when the SAME marketing_lead_id is re-sent (webhook retry)
--
-- Verify after deploy:
--   select proname from pg_proc where proname = 'ingest_marketing_preapproval_lead';

notify pgrst, 'reload schema';
