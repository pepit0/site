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

export function inventoryMakeModelTitle(row) {
  return `${row.make} ${row.model}`.trim().toLocaleUpperCase("en-CA");
}

export function inventoryOdometerLabel(row) {
  return row.odometer_km != null ? `${row.odometer_km.toLocaleString("en-CA")} km` : "Kms TBD";
}

export function inventoryYearKmLine(row) {
  return `${row.year} · ${inventoryOdometerLabel(row)}`;
}

export function inventoryUnitSeoTitle(row) {
  return `${row.year} ${inventoryMakeModelTitle(row)}`;
}

export function inventoryUnitSeoDescription(row) {
  return `${row.year} ${inventoryMakeModelTitle(row)} — ${inventoryYearKmLine(row)}. ${row.status}. ${inventoryPublicPriceLabel(row)}. View photos at Temptation Motorsports, Edmonton.`;
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
    seller: inventorySeller(siteOrigin),
    itemCondition: "https://schema.org/UsedCondition"
  };
}

export function buildInventoryProductJsonLd(row, { siteOrigin, supabaseUrl }) {
  const path = `/inventory/${row.id}`;
  const url = `${siteOrigin}${path}`;
  const title = inventoryMakeModelTitle(row);
  const image = row.photo_paths?.[0] ? inventoryPhotoAbsoluteUrl(row.photo_paths[0], supabaseUrl) : null;
  const offers = buildInventoryProductOffer(row, { siteOrigin, offerUrl: url });

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${row.year} ${title}`,
    description: inventoryUnitSeoDescription(row),
    url,
    sku: row.stock_number,
    category: row.category,
    brand: { "@type": "Brand", name: row.make },
    ...(image ? { image: [image] } : {}),
    ...(offers ? { offers } : {}),
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
      name: `${row.year} ${inventoryMakeModelTitle(row)}`,
      url
    };
    const offers = buildInventoryProductOffer(row, { siteOrigin, offerUrl: url });
    if (!offers) return listItem;
    const image = row.photo_paths?.[0] ? inventoryPhotoAbsoluteUrl(row.photo_paths[0], supabaseUrl) : null;
    return {
      ...listItem,
      item: {
        "@type": "Product",
        name: `${row.year} ${inventoryMakeModelTitle(row)}`,
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
