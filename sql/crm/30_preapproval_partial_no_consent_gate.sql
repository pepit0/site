-- CRM (postgres): allow partial pre-approvals without consent_contact.
-- Symptom: Edge ingest returns "Consent to be contacted is required." for partial rows.
-- Cause: application_status missing from webhook body defaulted to submitted.
--
-- Apply: re-run the full ingest function from sql/crm/crm_marketing_ingest_bridge.sql
-- (ingest_marketing_preapproval_lead), or run this file after syncing that function from the repo.

\echo 'Deploy ingest_marketing_preapproval_lead from sql/crm/crm_marketing_ingest_bridge.sql on the CRM project.'
