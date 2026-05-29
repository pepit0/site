-- CRM: partial → submitted upgrade + repeat applications (postgres, RLS off).
--
-- Run the FULL file on the CRM project:
--   sql/crm/crm_marketing_ingest_bridge.sql
--
-- What changed (2025-05):
-- 1) Same marketing_lead_id going partial → submitted:
--    - Updates the existing system lead (same row, not ignored)
--    - Adds activity + "Pre-approval completed" notification
--    - Webhook response: upgraded_to_submitted=true, duplicate=false
--
-- 2) Brand-new application (new marketing_lead_id, even same email as before):
--    - Always creates a NEW crm_system_leads row (unchanged behavior)
--    - duplicate=true only when the SAME marketing_lead_id is re-sent (webhook retry)
--
-- Verify after deploy:
--   select proname from pg_proc where proname = 'ingest_marketing_preapproval_lead';

notify pgrst, 'reload schema';
