# Marketplace Lister Chrome extension API

The **Marketplace Lister** Chrome extension (in the `finance` repo under `posting/marketplace-lister/`) reads vehicle stock from this site and auto-fills Facebook Marketplace listing forms.

## Prerequisites

1. Run **`sql/marketing/24_inventory_marketplace_extension.sql`** on the **marketing** Supabase project (SQL Editor, role **postgres**).
2. Deploy this site to Vercel with the environment variables below.
3. Load the extension in Chrome and configure it (see extension README).

## Vercel environment variables

Set these on the **site** Vercel project (Production; Preview optional for testing):

| Variable | Description |
|----------|-------------|
| `EXTENSION_API_KEY` | Long random secret. Same value in extension Options → API Key. |
| `SUPABASE_URL` | Marketing project URL (`https://xxxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (Settings → API). **Never** expose as `VITE_*`. |

Redeploy after adding or changing variables.

Generate a key (PowerShell):

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

## Extension settings

| Field | Value |
|-------|--------|
| CRM Base URL | `https://temptmotorsports.com` (your public site root, no trailing slash) |
| API Key | Same as `EXTENSION_API_KEY` |

Chrome will prompt for host permission to your domain when you save settings.

## API endpoints

All requests require header:

```http
x-api-key: <EXTENSION_API_KEY>
```

### GET `/api/extension/inventory`

Returns a JSON array of vehicles (excludes `Unlisted` status).

Example response item:

```json
{
  "id": "uuid",
  "year": 2020,
  "make": "Honda",
  "model": "CBR",
  "price": 12999,
  "mileage": 28000,
  "vin": "",
  "photos": ["https://....supabase.co/storage/v1/object/public/inventory-photos/..."],
  "posted_to_marketplace": false,
  "marketplace_listed_at": null
}
```

- **price:** `COALESCE(marketplace_list_price, cost)` from `inventory_units`.
- **mileage:** converted from `odometer_km` to miles (rounded).

### PATCH `/api/extension/inventory/:id/marketplace-status`

Request body:

```json
{
  "posted": true,
  "listedAt": "2026-05-26T14:30:00.000Z"
}
```

Updates `posted_to_marketplace` and `marketplace_listed_at` on the unit.

## Smoke tests

Replace `YOUR_KEY` and your domain:

```bash
curl -s -H "x-api-key: YOUR_KEY" https://temptmotorsports.com/api/extension/inventory | head -c 500
```

```bash
curl -s -X PATCH \
  -H "x-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"posted":true,"listedAt":"2026-05-26T12:00:00.000Z"}' \
  https://temptmotorsports.com/api/extension/inventory/UNIT_UUID/marketplace-status
```

## Admin inventory

At **`/admin/inventory`**, admins can set an optional **Facebook list price**. If empty, the API uses **Cost** for the extension price field.

**Listed on FB** status and date are set by the extension (Mark as Posted on Facebook), shown read-only in the edit form.

## Troubleshooting

| Symptom | Check |
|---------|--------|
| `401 Unauthorized` | API key mismatch between Vercel and extension |
| `500 Server configuration error` | Missing `EXTENSION_API_KEY`, `SUPABASE_URL`, or `SUPABASE_SERVICE_ROLE_KEY` on Vercel |
| `404` on GET `/api/extension/inventory` | SPA rewrite swallowing `/api` — ensure `vercel.json` excludes `/api/` from `index.html` rewrite |
| Empty array | All units may be `Unlisted`, or table empty |
| Column errors in logs | Run migration `24_inventory_marketplace_extension.sql` |
