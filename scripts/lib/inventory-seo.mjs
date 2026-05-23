/** Build-time SEO helpers (keep in sync with src/seo/inventoryStructuredData.ts). */

export const INVENTORY_CALL_FOR_PRICING = "Call for pricing";

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
  return `${row.year} ${inventoryMakeModelTitle(row)} — ${inventoryYearKmLine(row)}. ${row.status}. ${INVENTORY_CALL_FOR_PRICING}. View photos at Temptation Motorsports, Edmonton.`;
}

export function inventoryPhotoAbsoluteUrl(photoPath, supabaseUrl) {
  const base = supabaseUrl.replace(/\/+$/, "");
  const encoded = photoPath
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${base}/storage/v1/object/public/inventory-photos/${encoded}`;
}

export function buildInventoryProductJsonLd(row, { siteOrigin, supabaseUrl }) {
  const path = `/inventory/${row.id}`;
  const url = `${siteOrigin}${path}`;
  const title = inventoryMakeModelTitle(row);
  const image = row.photo_paths?.[0] ? inventoryPhotoAbsoluteUrl(row.photo_paths[0], supabaseUrl) : null;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${row.year} ${title}`,
    description: inventoryUnitSeoDescription(row),
    sku: row.stock_number,
    category: row.category,
    brand: { "@type": "Brand", name: row.make },
    ...(image ? { image: [image] } : {}),
    offers: {
      "@type": "Offer",
      url,
      availability: inventorySchemaAvailability(row.status),
      priceCurrency: "CAD",
      seller: {
        "@type": "Organization",
        name: "Temptation Motorsports",
        url: siteOrigin
      },
      itemCondition: "https://schema.org/UsedCondition"
    },
    additionalProperty: [
      { "@type": "PropertyValue", name: "Model year", value: String(row.year) },
      { "@type": "PropertyValue", name: "Odometer", value: inventoryOdometerLabel(row) },
      { "@type": "PropertyValue", name: "Listing price", value: INVENTORY_CALL_FOR_PRICING }
    ]
  };
}

export function buildInventoryItemListJsonLd(rows, { siteOrigin, supabaseUrl }) {
  const itemListElement = rows.map((row, index) => {
    const path = `/inventory/${row.id}`;
    const image = row.photo_paths?.[0] ? inventoryPhotoAbsoluteUrl(row.photo_paths[0], supabaseUrl) : null;
    return {
      "@type": "ListItem",
      position: index + 1,
      url: `${siteOrigin}${path}`,
      item: {
        "@type": "Product",
        name: `${row.year} ${inventoryMakeModelTitle(row)}`,
        ...(image ? { image } : {}),
        offers: {
          "@type": "Offer",
          availability: inventorySchemaAvailability(row.status),
          priceCurrency: "CAD",
          seller: { "@type": "Organization", name: "Temptation Motorsports", url: siteOrigin }
        }
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
