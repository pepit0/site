import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  isAuthorized,
  sendMethodNotAllowed,
  sendServerMisconfigured,
  sendUnauthorized
} from "./_lib/auth.js";
import { normalizeIncomingListing, scoreListingSimilarity } from "./_lib/marketplaceComp.js";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin.js";

type CompSearchRow = {
  id: string;
  year: number | null;
  make: string;
  model: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    sendMethodNotAllowed(res);
    return;
  }

  if (!process.env.EXTENSION_API_KEY) {
    sendServerMisconfigured(res);
    return;
  }

  if (!isAuthorized(req)) {
    sendUnauthorized(res);
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    sendServerMisconfigured(res);
    return;
  }

  const body = req.body;
  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "Invalid JSON body." });
    return;
  }

  const searchId = typeof (body as { searchId?: unknown }).searchId === "string"
    ? (body as { searchId: string }).searchId.trim()
    : "";
  const listingsRaw = (body as { listings?: unknown }).listings;

  if (!searchId) {
    res.status(400).json({ error: "searchId is required." });
    return;
  }
  if (!Array.isArray(listingsRaw) || listingsRaw.length === 0) {
    res.status(400).json({ error: "listings array is required." });
    return;
  }

  const { data: searchRow, error: searchError } = await supabase
    .from("marketplace_comp_searches")
    .select("id, year, make, model")
    .eq("id", searchId)
    .maybeSingle();

  if (searchError) {
    res.status(500).json({ error: searchError.message });
    return;
  }
  if (!searchRow) {
    res.status(404).json({ error: "Search not found." });
    return;
  }

  const search = searchRow as CompSearchRow;
  const rows = [];
  for (const raw of listingsRaw) {
    if (!raw || typeof raw !== "object") continue;
    const normalized = normalizeIncomingListing(raw as Record<string, unknown>);
    if (!normalized) continue;
    rows.push({
      search_id: search.id,
      fb_item_id: normalized.fbItemId,
      title: normalized.title,
      price_text: normalized.priceText,
      price_cad: normalized.priceCad,
      location_text: normalized.locationText,
      listing_url: normalized.listingUrl,
      image_url: normalized.imageUrl,
      posted_label: normalized.postedLabel,
      similarity_score: scoreListingSimilarity(search, normalized.title),
      scraped_at: new Date().toISOString()
    });
  }

  if (rows.length === 0) {
    res.status(400).json({ error: "No valid listings in payload." });
    return;
  }

  const { data, error } = await supabase
    .from("marketplace_comp_results")
    .upsert(rows, { onConflict: "search_id,listing_url" })
    .select("id");

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({
    searchId: search.id,
    saved: data?.length ?? rows.length,
    received: listingsRaw.length
  });
}
