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
  search: { year: number | null; make: string; model: string },
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

export type IncomingCompListing = {
  title?: unknown;
  listingUrl?: unknown;
  priceText?: unknown;
  priceCad?: unknown;
  locationText?: unknown;
  imageUrl?: unknown;
  postedLabel?: unknown;
  fbItemId?: unknown;
};

export function normalizeIncomingListing(raw: IncomingCompListing): {
  title: string;
  listingUrl: string;
  priceText: string | null;
  priceCad: number | null;
  locationText: string | null;
  imageUrl: string | null;
  postedLabel: string | null;
  fbItemId: string | null;
} | null {
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const listingUrl = typeof raw.listingUrl === "string" ? raw.listingUrl.trim() : "";
  if (!title || !listingUrl || !listingUrl.includes("facebook.com/marketplace/item/")) {
    return null;
  }

  const priceText = typeof raw.priceText === "string" ? raw.priceText.trim() || null : null;
  let priceCad: number | null = null;
  if (typeof raw.priceCad === "number" && Number.isFinite(raw.priceCad) && raw.priceCad >= 0) {
    priceCad = raw.priceCad;
  } else if (priceText) {
    priceCad = parseCadPriceFromText(priceText);
  }

  return {
    title,
    listingUrl: listingUrl.split("?")[0],
    priceText,
    priceCad,
    locationText: typeof raw.locationText === "string" ? raw.locationText.trim() || null : null,
    imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl.trim() || null : null,
    postedLabel: typeof raw.postedLabel === "string" ? raw.postedLabel.trim() || null : null,
    fbItemId:
      typeof raw.fbItemId === "string"
        ? raw.fbItemId.trim() || extractFacebookItemId(listingUrl)
        : extractFacebookItemId(listingUrl)
  };
}
