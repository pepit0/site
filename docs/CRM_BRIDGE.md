# Marketing site → CRM bridge

When someone submits **Get pre-approved** on the marketing site, the row is stored in `preapproval_leads` on the **marketing** Supabase project. A **database webhook** calls the CRM Edge Function, which creates a CRM customer, system lead, and in-app notifications.

**The CRM does not pull leads by itself.** Something on the CRM project must **receive the HTTP POST** and call Postgres RPC `ingest_marketing_preapproval_lead`. If that Edge Function is missing, returns 401, or sends a trimmed JSON body to the RPC, nothing useful happens in CRM even when marketing rows exist.

See **[CRM Edge Function reference](CRM_INGEST_EDGE_FUNCTION_REFERENCE.md)** for a copy-paste handler and a CRM-side checklist.

## Tables: marketing vs CRM (important)

| Project | Table | Role |
|---------|--------|------|
| **Marketing** | `public.preapproval_leads` | Full application from the website RPC. This is the “source of truth” for the form. |
| **CRM** | `public.crm_public_preapproval_leads` | **Public copy** of the lead for staff (same core + extended columns once `crm_marketing_ingest_bridge.sql` has been applied). Open this in the CRM Table Editor—not a table named `preapproval_leads` on CRM (that would be a different object and is often empty). |
| **CRM** | `public.crm_system_leads` | **Queue / assignment** only: links `marketing_lead_id` → CRM `preapproval_lead_id` + `customer_id`, plus assignee. It is **not** supposed to repeat every marketing column; detail lives on `crm_public_preapproval_leads`, `crm_customers.profile_metadata`, and the activity comment. |

Re-run [`sql/crm/crm_marketing_ingest_bridge.sql`](crm/crm_marketing_ingest_bridge.sql) on CRM so `crm_public_preapproval_leads` gets extended columns and ingest fills them.

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
- **Webhook payload shape**: `ingest_marketing_preapproval_lead` accepts the raw Supabase Database Webhook body (`type` / `table` / `record`), a bare row object, or common wrappers (`record.record`, `data`, `new`). Field names may be **snake_case** (Postgres columns) or **camelCase** (some Edge Function forwards); both are read. Re-run [`sql/crm/crm_marketing_ingest_bridge.sql`](crm/crm_marketing_ingest_bridge.sql) after changes.
- **401 Unauthorized**: `MARKETING_WEBHOOK_SECRET` must match the webhook header exactly.
- **Schema errors in CRM**: Re-run `sql/crm_marketing_ingest_bridge.sql` on the CRM project as `postgres`.
- **No notifications**: Team members must exist in `crm_user_directory` (open CRM once while signed in) or `crm_access_allowlist`.
