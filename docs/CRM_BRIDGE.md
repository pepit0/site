# Marketing site → CRM bridge

When someone submits **Get pre-approved** on the marketing site, the row is stored in `preapproval_leads` on the **marketing** Supabase project. A **database webhook** calls the CRM Edge Function, which creates a CRM customer, system lead, and in-app notifications.

## Prerequisites

- Marketing project: `sql/marketing/04_submit_public_preapproval_lead.sql` (and optionally `05_preapproval_crm_sync_columns.sql`).
- CRM project: `sql/crm_security.sql`, `sql/crm_public_preapproval_leads.sql`, **`sql/crm/crm_marketing_ingest_bridge.sql`** (copy in this repo; same file lives in **auto-finance-manager** `sql/crm_marketing_ingest_bridge.sql`).
- CRM Edge Function deployed: `ingest-marketing-preapproval` (see auto-finance-manager `docs/CRM_BRIDGE.md`).

## Marketing Supabase: database webhook

1. CRM → deploy Edge Function and note the URL, e.g.  
   `https://<crm-project-ref>.supabase.co/functions/v1/ingest-marketing-preapproval`
2. Generate a long random **shared secret** (same value in both places).
3. Marketing Supabase → **Database** → **Webhooks** → **Create webhook**:
   - **Table**: `public.preapproval_leads`
   - **Events**: `INSERT`
   - **HTTP request**: POST to the CRM function URL
   - **HTTP headers**: `X-Marketing-Webhook-Secret: <your-secret>`
   - **Payload**: include the new row (`record`)

4. CRM Supabase → **Edge Functions** → `ingest-marketing-preapproval` → **Secrets**:
   - `MARKETING_WEBHOOK_SECRET` = same secret
   - `SUPABASE_SERVICE_ROLE_KEY` = CRM service role (usually auto-injected)

## Verify

1. Submit a test application on the marketing site.
2. In CRM → **System leads**, see an unassigned lead with applicant details.
3. **Alerts** in the CRM header should show a new notification.
4. Assign the lead to a team member; the customer appears under **Customers** with that assignee.

## Troubleshooting

- **CRM still empty**: Check Marketing webhook delivery logs and CRM Edge Function logs.
- **401 Unauthorized**: `MARKETING_WEBHOOK_SECRET` must match the webhook header exactly.
- **Schema errors in CRM**: Re-run `sql/crm_marketing_ingest_bridge.sql` on the CRM project as `postgres`.
- **No notifications**: Team members must exist in `crm_user_directory` (open CRM once while signed in) or `crm_access_allowlist`.
