# Sell your ride — Supabase setup and testing

Run these in the **marketing** Supabase project (SQL Editor, role **postgres**), in order:

1. [`../sql/marketing/01_inventory_units.sql`](../sql/marketing/01_inventory_units.sql) (if not already applied)
2. [`../sql/marketing/06_sell_ride_submissions.sql`](../sql/marketing/06_sell_ride_submissions.sql) — table `sell_ride_submissions`, RLS for inventory admins, RPCs `sell_ride_begin_draft`, `sell_ride_submit`
3. [`../sql/marketing/07_storage_sell_ride_photos.sql`](../sql/marketing/07_storage_sell_ride_photos.sql) — bucket `sell-ride-photos` and storage policies
4. [`../sql/marketing/08_sell_ride_submissions_admin_delete.sql`](../sql/marketing/08_sell_ride_submissions_admin_delete.sql) — optional `DELETE` policy for rejected rows (client-side delete)
5. [`../sql/marketing/09_admin_delete_rejected_sell_ride_submission.sql`](../sql/marketing/09_admin_delete_rejected_sell_ride_submission.sql) — **recommended** RPC `admin_delete_rejected_sell_ride_submission` so **Delete permanently** works even when PostgREST/RLS blocks direct `DELETE` (run if delete still fails after `08`)

If bucket creation via SQL is blocked, create bucket **sell-ride-photos** in the Dashboard (public, same size/MIME limits as inventory photos), then run only the `policy` parts of `07`.

## App routes

- Public: `/sell-your-ride` (info) and `/sell-your-ride/apply` (two-step form + review + submit).
- Admin (inventory allowlist): `/admin/inventory` → **Sell submissions** tab (or `/admin/inventory?tab=sell`). Legacy URL `/admin/sell-queue` redirects there. List submitted applications, edit fields, reject, or publish to `inventory_units` (photos are **downloaded** from `sell-ride-photos` and **re-uploaded** to `inventory-photos` under the new unit id).

## Manual test checklist

1. **Apply — validation:** Open `/sell-your-ride/apply` without Supabase env errors. Try Continue with &lt;3 photos, missing km, missing name — expect inline errors.
2. **Apply — success:** Complete both steps; confirm draft RPC, uploads under `{submissionId}/`, then submit RPC; success dialog and optional storage check in Dashboard.
3. **Storage:** Confirm anon cannot upload to a path whose first segment is not a valid `draft` submission id (or wrong status).
4. **Admin queue:** Sign in as inventory admin; open `/admin/inventory`, switch to **Sell submissions**; select row; Save changes; Reject with reason (row leaves submitted list).
5. **Rejected list:** Click **Rejected**; open a row; confirm read-only details and photos; **Restore to submitted queue** moves it back to **Submitted** (clears reject reason) so you can edit or publish again; **Delete permanently** removes the row (run **`09_admin_delete_rejected_sell_ride_submission.sql`** if delete fails; optional `08` for direct `DELETE`). Photos are removed from `sell-ride-photos` after the row is deleted.
6. **Publish:** With a submitted row, set stock #, cost, status; Publish — new row appears on the **Catalog** tab and on public `/inventory` with photos; submission shows `published` (no longer in queue).

## Notes

- **Publish** is implemented in the browser (insert unit → copy blobs → update paths → mark submission published), with rollback on failure (delete new unit and uploaded inventory photos when possible).
- Orphan **`draft`** rows can remain if a user abandons after `sell_ride_begin_draft`; optional cleanup later.
