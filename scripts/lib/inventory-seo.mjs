/** Build-time SEO helpers (keep in sync with src/seo/inventoryStructuredData.ts + inventoryPublicPrice.ts). */

export const INVENTORY_CALL_FOR_PRICING = "Call for pricing";

export function parseInventoryListPriceCad(raw) {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function inventoryPublicListPriceCad(row) {
  return parseInventoryListPriceCad(row.list_price_cad);
}

export function formatInventoryPriceCad(amount) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0
  }).format(amount);
}

export function inventoryPublicPriceLabel(row) {
  const price = inventoryPublicListPriceCad(row);
  return price != null ? formatInventoryPriceCad(price) : INVENTORY_CALL_FOR_PRICING;
}

export function schemaOfferPriceCad(amount) {
  return amount.toFixed(2);
}

export function schemaOfferPriceValidUntil(updatedAt) {
  const base = new Date(updatedAt);
  const date = Number.isNaN(base.getTime()) ? new Date() : base;
  date.setUTCDate(date.getUTCDate() + 90);
  return date.toISOString().slice(0, 10);
}

export function inventorySchemaAvailability(status) {
  switch (status) {
    case "Available":
      return "https://schema.org/InStock";
    case "Pending":
      return "https://schema.org/PreOrder";
    case "Sold":
      return "https://schema.org/SoldOut";
    default:
      return "https://schema.org/InStock";
  }
}

export function inventoryRowHasProductJsonLd(row) {
  return row.status !== "Sold" && inventoryPublicListPriceCad(row) != null;
}

export function inventoryMakeModelTitle(row) {
  return `${row.make} ${row.model}`.trim().toLocaleUpperCase("en-CA");
}

export function inventoryOdometerLabel(row) {
  return row.odometer_km != null ? `${row.odometer_km.toLocaleString("en-CA")} km` : "Kms TBD";
}

export function inventoryYearKmLine(row) {
  return `${row.year} · ${inventoryOdometerLabel(row)}`;
}

function inventoryUnitSeoStockLabel(row) {
  return `Stock ${row.stock_number.trim()}`;
}

export function inventoryUnitSeoTitle(row) {
  return `${row.year} ${inventoryMakeModelTitle(row)} · ${inventoryUnitSeoStockLabel(row)}`;
}

export function inventoryUnitSeoDescription(row) {
  return `${row.year} ${inventoryMakeModelTitle(row)} · ${inventoryUnitSeoStockLabel(row)} — ${inventoryYearKmLine(row)}. ${row.status}. ${inventoryPublicPriceLabel(row)}. View photos at Temptation Motorsports, Edmonton.`;
}

/** Keep in sync with src/lib/inventoryFinancingRoutes.ts */
export function financingPathForCategory(category) {
  switch (category) {
    case "Motorcycle":
      return "/financing/motorcycle-financing";
    case "ATV":
      return "/financing/atv-financing";
    case "Snowmobile":
      return "/financing/snowmobile-financing";
    case "Side by side":
      return "/financing/side-by-side-financing";
    case "Watercraft":
      return "/financing/jet-ski-financing";
    case "Trailer":
      return "/financing/trailer-financing";
    default:
      return "/financing";
  }
}

/** Keep in sync with src/lib/inventoryFinancingRoutes.ts */
export function financingNavLabelForCategory(category) {
  switch (category) {
    case "Motorcycle":
      return "Motorcycle financing";
    case "ATV":
      return "ATV financing";
    case "Snowmobile":
      return "Snowmobile financing";
    case "Side by side":
      return "Side-by-side financing";
    case "Watercraft":
      return "Jet ski financing";
    case "Trailer":
      return "Trailer financing";
    default:
      return "Financing";
  }
}

function inventoryCategoryArticle(category) {
  return /^[aeiou]/i.test(String(category).trim()) ? "an" : "a";
}

/** Unit-specific listing copy from public inventory fields only (no fabricated specs). */
export function buildInventoryUnitListingParagraphs(row) {
  const ymm = `${row.year} ${inventoryMakeModelTitle(row)}`;
  const article = inventoryCategoryArticle(row.category);
  const paragraphs = [
    `This ${ymm} is listed in our inventory as ${article} ${row.category}. Stock number ${String(row.stock_number).trim()}.`
  ];

  if (row.odometer_km != null) {
    paragraphs.push(`The odometer reads ${row.odometer_km.toLocaleString("en-CA")} km.`);
  } else {
    paragraphs.push("Odometer is not listed for this unit yet.");
  }

  const listPrice = inventoryPublicListPriceCad(row);
  const priceSentence =
    listPrice != null
      ? `Listed at ${formatInventoryPriceCad(listPrice)}.`
      : "Pricing is by phone — call for a quote on this unit.";
  paragraphs.push(`It is marked ${row.status} on our site. ${priceSentence}`);

  const photoCount = Array.isArray(row.photo_paths) ? row.photo_paths.length : 0;
  if (photoCount > 0) {
    paragraphs.push(
      `This listing includes ${photoCount} photo${photoCount === 1 ? "" : "s"} of this unit.`
    );
  }

  return paragraphs;
}

export function inventoryPhotoAbsoluteUrl(photoPath, supabaseUrl) {
  const base = supabaseUrl.replace(/\/+$/, "");
  const encoded = photoPath
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${base}/storage/v1/object/public/inventory-photos/${encoded}`;
}

function inventorySeller(siteOrigin) {
  return { "@type": "Organization", name: "Temptation Motorsports", url: siteOrigin };
}

export function buildInventoryProductOffer(row, { siteOrigin, offerUrl }) {
  const price = inventoryPublicListPriceCad(row);
  if (price == null) return undefined;
  return {
    "@type": "Offer",
    url: offerUrl,
    price: schemaOfferPriceCad(price),
    priceCurrency: "CAD",
    availability: inventorySchemaAvailability(row.status),
    priceValidUntil: schemaOfferPriceValidUntil(row.updated_at),
    seller: inventorySeller(siteOrigin),
    itemCondition: "https://schema.org/UsedCondition"
  };
}

export function buildInventoryProductJsonLd(row, { siteOrigin, supabaseUrl }) {
  if (!inventoryRowHasProductJsonLd(row)) return null;

  const path = `/inventory/${row.id}`;
  const url = `${siteOrigin}${path}`;
  const image = row.photo_paths?.[0] ? inventoryPhotoAbsoluteUrl(row.photo_paths[0], supabaseUrl) : null;
  const offers = buildInventoryProductOffer(row, { siteOrigin, offerUrl: url });
  if (!offers) return null;

  const mpn = row.model.trim();
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: inventoryUnitSeoTitle(row),
    description: inventoryUnitSeoDescription(row),
    url,
    sku: row.stock_number,
    ...(mpn ? { mpn } : {}),
    category: row.category,
    brand: { "@type": "Brand", name: row.make },
    ...(image ? { image: [image] } : {}),
    offers,
    additionalProperty: [
      { "@type": "PropertyValue", name: "Model year", value: String(row.year) },
      { "@type": "PropertyValue", name: "Odometer", value: inventoryOdometerLabel(row) },
      { "@type": "PropertyValue", name: "Listing price", value: inventoryPublicPriceLabel(row) },
      { "@type": "PropertyValue", name: "Availability", value: row.status }
    ]
  };
}

export function buildInventoryItemListJsonLd(rows, { siteOrigin, supabaseUrl }) {
  const itemListElement = rows.map((row, index) => {
    const path = `/inventory/${row.id}`;
    const url = `${siteOrigin}${path}`;
    const listItem = {
      "@type": "ListItem",
      position: index + 1,
      name: inventoryUnitSeoTitle(row),
      url
    };
    if (!inventoryRowHasProductJsonLd(row)) return listItem;

    const offers = buildInventoryProductOffer(row, { siteOrigin, offerUrl: url });
    if (!offers) return listItem;

    const image = row.photo_paths?.[0] ? inventoryPhotoAbsoluteUrl(row.photo_paths[0], supabaseUrl) : null;
    const mpn = row.model.trim();
    return {
      ...listItem,
      item: {
        "@type": "Product",
        name: inventoryUnitSeoTitle(row),
        sku: row.stock_number,
        ...(mpn ? { mpn } : {}),
        ...(image ? { image } : {}),
        offers
      }
    };
  });

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Temptation Motorsports inventory",
    description:
      "Motorcycles, ATVs, snowmobiles, side-by-sides, watercraft, and trailers for sale in Edmonton.",
    numberOfItems: itemListElement.length,
    itemListElement
  };
}

function normalizeMake(make) {
  return String(make).trim().toLowerCase();
}

function priceDistance(a, b) {
  const priceA = inventoryPublicListPriceCad(a);
  const priceB = inventoryPublicListPriceCad(b);
  if (priceA == null || priceB == null) return null;
  return Math.abs(priceA - priceB);
}

function scoreCandidate(current, candidate) {
  let score = 0;
  if (candidate.category === current.category) score += 1000;
  if (normalizeMake(candidate.make) === normalizeMake(current.make)) score += 500;

  const distance = priceDistance(current, candidate);
  if (distance != null) {
    score += Math.max(0, 200 - Math.floor(distance / 500));
  }

  score += candidate.year;
  return score;
}

function sortCandidates(current, candidates) {
  return [...candidates].sort((a, b) => {
    const scoreDiff = scoreCandidate(current, b) - scoreCandidate(current, a);
    if (scoreDiff !== 0) return scoreDiff;
    const updatedDiff = b.updated_at.localeCompare(a.updated_at);
    if (updatedDiff !== 0) return updatedDiff;
    return a.id.localeCompare(b.id);
  });
}

function eligibleCandidates(current, candidates) {
  return candidates.filter((row) => row.id !== current.id && row.status !== "Sold");
}

function pickFromPool(current, pool, limit, picked) {
  const seen = new Set(picked.map((row) => row.id));
  const next = sortCandidates(
    current,
    pool.filter((row) => !seen.has(row.id))
  );
  for (const row of next) {
    if (picked.length >= limit) break;
    picked.push(row);
    seen.add(row.id);
  }
  return picked;
}

/** Keep in sync with src/lib/inventorySimilarUnits.ts */
export function pickSimilarInventoryUnits(current, candidates, limit = 4) {
  if (limit <= 0) return [];

  const eligible = eligibleCandidates(current, candidates);
  const picked = [];

  pickFromPool(
    current,
    eligible.filter((row) => row.category === current.category),
    limit,
    picked
  );

  if (picked.length < limit) {
    pickFromPool(
      current,
      eligible.filter((row) => normalizeMake(row.make) === normalizeMake(current.make)),
      limit,
      picked
    );
  }

  if (picked.length < limit) {
    pickFromPool(current, eligible, limit, picked);
  }

  return picked;
}
