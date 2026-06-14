/** Facebook Marketplace comp search helpers (admin sourcing tool). */

export type MarketplaceLocationOption = {
  slug: string;
  label: string;
};

export const MARKETPLACE_LOCATION_OPTIONS: MarketplaceLocationOption[] = [
  { slug: "edmonton", label: "Edmonton, AB" },
  { slug: "calgary", label: "Calgary, AB" },
  { slug: "reddeer", label: "Red Deer, AB" },
  { slug: "lethbridge", label: "Lethbridge, AB" },
  { slug: "fortmcmurray", label: "Fort McMurray, AB" },
  { slug: "vancouver", label: "Vancouver, BC" },
  { slug: "victoria", label: "Victoria, BC" },
  { slug: "kelowna", label: "Kelowna, BC" },
  { slug: "winnipeg", label: "Winnipeg, MB" },
  { slug: "regina", label: "Regina, SK" },
  { slug: "saskatoon", label: "Saskatoon, SK" },
  { slug: "toronto", label: "Toronto, ON" },
  { slug: "ottawa", label: "Ottawa, ON" },
  { slug: "montreal", label: "Montreal, QC" },
  { slug: "halifax", label: "Halifax, NS" }
];

export type MarketplaceCompSearchInput = {
  year: number | null;
  make: string;
  model: string;
  locationSlug: string;
  minPriceCad?: number | null;
  maxPriceCad?: number | null;
};

export function buildMarketplaceQueryText(input: Pick<MarketplaceCompSearchInput, "year" | "make" | "model">): string {
  const parts = [
    input.year != null && Number.isFinite(input.year) ? String(Math.trunc(input.year)) : "",
    input.make.trim(),
    input.model.trim()
  ].filter(Boolean);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function normalizeLocationSlug(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "");
}

export function buildFacebookMarketplaceSearchUrl(input: MarketplaceCompSearchInput): string {
  const query = buildMarketplaceQueryText(input);
  const slug = normalizeLocationSlug(input.locationSlug) || "edmonton";
  const params = new URLSearchParams();
  params.set("query", query);
  params.set("sortBy", "creation_time_descend");
  if (input.minPriceCad != null && input.minPriceCad > 0) {
    params.set("minPrice", String(Math.round(input.minPriceCad)));
  }
  if (input.maxPriceCad != null && input.maxPriceCad > 0) {
    params.set("maxPrice", String(Math.round(input.maxPriceCad)));
  }
  return `https://www.facebook.com/marketplace/${encodeURIComponent(slug)}/search/?${params.toString()}`;
}

export function parseCadPriceFromText(text: string): number | null {
  const match = text.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const n = Number.parseFloat(match[1].replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function extractFacebookItemId(listingUrl: string): string | null {
  try {
    const path = new URL(listingUrl).pathname;
    const match = path.match(/\/marketplace\/item\/(\d+)/i);
    return match?.[1] ?? null;
  } catch {
    const match = listingUrl.match(/\/marketplace\/item\/(\d+)/i);
    return match?.[1] ?? null;
  }
}

export function scoreListingSimilarity(
  search: Pick<MarketplaceCompSearchInput, "year" | "make" | "model">,
  title: string
): number {
  const titleLower = title.toLowerCase();
  let score = 0;

  if (search.year != null && titleLower.includes(String(search.year))) {
    score += 35;
  }

  const makeTokens = search.make
    .toLowerCase()
    .split(/[\s-/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2);
  const modelTokens = search.model
    .toLowerCase()
    .split(/[\s-/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);

  for (const token of makeTokens) {
    if (titleLower.includes(token)) score += 20;
  }
  for (const token of modelTokens) {
    if (titleLower.includes(token)) score += 12;
  }

  return Math.min(100, score);
}

export type MarketplaceCompResultRow = {
  id: string;
  search_id: string;
  fb_item_id: string | null;
  title: string;
  price_text: string | null;
  price_cad: number | null;
  location_text: string | null;
  listing_url: string;
  image_url: string | null;
  posted_label: string | null;
  similarity_score: number | null;
  scraped_at: string;
};

export type MarketplaceCompSearchRow = {
  id: string;
  inventory_unit_id: string | null;
  year: number | null;
  make: string;
  model: string;
  query_text: string;
  location_slug: string;
  min_price_cad: number | null;
  max_price_cad: number | null;
  facebook_search_url: string;
  created_at: string;
};
