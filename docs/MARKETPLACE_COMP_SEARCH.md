# Facebook Marketplace comp search

Admin tool for finding similar Facebook Marketplace listings (newest first) and capturing visible results into Supabase.

Kijiji and AutoTrader are planned for later; this flow is Facebook-only.

## Setup

1. Run `sql/marketing/27_marketplace_comp_search.sql` on Supabase (postgres role).
2. Set `EXTENSION_API_KEY` in Vercel (same key used by other extension endpoints).
3. Load the Chrome extension from `extension/marketplace-comp-capture/` (Developer mode → Load unpacked).

## Admin workflow

1. Open **Admin → Facebook comps** (`/admin/marketplace-comps`).
2. Enter year / make / model, city, optional price range.
3. Click **Search on Facebook** — saves a search row, sets `?search=<uuid>`, opens Facebook sorted by newest.
4. Copy the **Active search ID** into the extension popup (with API base URL and key).
5. On Facebook search results, scroll to load listings, then click **Capture visible listings**.
6. Back in admin, click **Refresh results** to see captured rows with similarity scores.

Optional: open `/admin/marketplace-comps?unitId=<inventory-uuid>` to pre-fill year/make/model from inventory.

## Extension API

`POST /api/extension/marketplace-comps`

Headers:

- `Content-Type: application/json`
- `x-api-key: <EXTENSION_API_KEY>`

Body:

```json
{
  "searchId": "uuid-from-admin-page",
  "listings": [
    {
      "title": "2022 Can-Am Outlander 850",
      "listingUrl": "https://www.facebook.com/marketplace/item/123456789/",
      "priceText": "$12,500",
      "priceCad": 12500,
      "locationText": "Edmonton, AB",
      "imageUrl": "https://...",
      "postedLabel": null,
      "fbItemId": "123456789"
    }
  ]
}
```

Listings upsert on `(search_id, listing_url)`. Similarity is scored server-side from the saved search year/make/model.

## Local dev

- Site: `npm run dev` (default `http://localhost:5173`)
- Extension popup API base: `http://localhost:5173` when testing against a local API proxy, or your Vercel preview URL
- Facebook capture only works on `https://www.facebook.com/marketplace/*`
