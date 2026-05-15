# Temptation Motorsports (marketing site)

Vite + React + TypeScript. Pre-approval and inventory are in this repo.

## Setup

1. Copy `.env.example` to `.env.local` and fill in values from your **marketing** Supabase project (Settings → API).
2. For a **separate** Supabase project from the CRM, set `VITE_SITE_MARKETING_ONLY=true`.
3. In Supabase **SQL Editor**, set the query **role to `postgres`** (not `anon` / `authenticated`). Then run **`sql/marketing/01_inventory_units.sql`** then **`sql/marketing/02_storage_inventory_photos.sql`**. If you still see `permission denied for schema public`, run **`sql/marketing/00_public_schema_for_owner.sql`** once as `postgres` (it only runs `GRANT` + a diagnostic `SELECT`—do not hand-edit schema ownership in SQL unless you know the owner role). Then run `01` again. If you already ran an older `01` without **Sold** / **Unlisted** on `inventory_units`, also run **`sql/marketing/03_inventory_status_sold_unlisted.sql`**. Create admin users under **Authentication → Users**, then run `insert into public.inventory_admins (user_id) values ('<user-uuid>');` for each admin.
4. **Pre-approval (Get pre-approved form):** run **`sql/marketing/04_submit_public_preapproval_lead.sql`** on the marketing project (creates `preapproval_leads` + `submit_public_preapproval_lead` RPC). Optional: **`sql/marketing/05_preapproval_crm_sync_columns.sql`** for sync status columns.

5. **CRM bridge (two Supabase projects):** after CRM runs **`sql/crm_marketing_ingest_bridge.sql`** and deploys the Edge Function, configure the marketing DB webhook per **`docs/CRM_BRIDGE.md`**. Pre-approvals then appear in CRM **System leads** with alerts.

**Inventory:** Public units load from the view `inventory_units_public` (no `cost` column; **Unlisted** rows are excluded). Admins manage stock at **`/admin/inventory`** after sign-in. If you already ran older `01` without **Sold** / **Unlisted**, run **`sql/marketing/03_inventory_status_sold_unlisted.sql`**. Photos live in the **`inventory-photos`** Storage bucket.

**Click-by-click Supabase + Windows help:** in the **auto-finance-manager** repo open **`docs/SUPABASE_BEGINNER_CLICKS.md`**.

Full checklist (two projects, hosting): **`docs/SETUP_CHECKLIST.md`** in the same repo.

```bash
npm install
npm run dev
```
