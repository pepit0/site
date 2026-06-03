import type { InventoryPublicRow, InventoryPublicStatus } from "../data/inventory";
import {
  inventoryMakeModelTitle,
  inventoryOdometerLabel,
  inventoryYearKmLine,
  INVENTORY_PHOTOS_BUCKET
} from "../data/inventory";
import { absoluteUrl, hasPublicSiteOrigin } from "../lib/siteUrl";

export const INVENTORY_CALL_FOR_PRICING = "Call for pricing";

/** Schema.org availability URL for public inventory status. */
export function inventorySchemaAvailability(status: InventoryPublicStatus): string {
  switch (status) {
    case "Available":
      return "https://schema.org/InStock";
    case "Pending":
      return "https://schema.org/PreOrder";
    case "Sold":
      return "https://schema.org/SoldOut";
  }
}

export function inventoryUnitSeoTitle(row: Pick<InventoryPublicRow, "year" | "make" | "model">): string {
  return `${row.year} ${inventoryMakeModelTitle(row)}`;
}

export function inventoryUnitSeoDescription(row: InventoryPublicRow): string {
  return `${row.year} ${inventoryMakeModelTitle(row)} — ${inventoryYearKmLine(row)}. ${row.status}. ${INVENTORY_CALL_FOR_PRICING}. View photos at Temptation Motorsports, Edmonton.`;
}

export function inventoryUnitCanonicalPath(unitId: string): string {
  return `/inventory/${unitId}`;
}

/** Absolute public URL for a stored inventory photo path. */
export function inventoryPhotoAbsoluteUrl(photoPath: string, supabaseUrl: string): string {
  const base = supabaseUrl.replace(/\/+$/, "");
  const encoded = photoPath
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${base}/storage/v1/object/public/${INVENTORY_PHOTOS_BUCKET}/${encoded}`;
}

export function inventoryUnitPrimaryImage(row: InventoryPublicRow, supabaseUrl: string): string | undefined {
  const first = row.photo_paths[0];
  return first ? inventoryPhotoAbsoluteUrl(first, supabaseUrl) : undefined;
}

/**
 * Product JSON-LD for a unit detail page. No Offer block: listings show "Call for pricing"
 * and Google requires a numeric price on Offer/Product rich-result markup.
 */
export function buildInventoryProductJsonLd(
  row: InventoryPublicRow,
  options: { supabaseUrl: string; siteOrigin?: string }
): Record<string, unknown> | null {
  const origin = options.siteOrigin ?? (hasPublicSiteOrigin() ? absoluteUrl("").replace(/\/$/, "") : "");
  if (!origin) return null;

  const path = inventoryUnitCanonicalPath(row.id);
  const url = `${origin}${path}`;
  const title = inventoryMakeModelTitle(row);
  const image = inventoryUnitPrimaryImage(row, options.supabaseUrl);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${row.year} ${title}`,
    description: inventoryUnitSeoDescription(row),
    url,
    sku: row.stock_number,
    category: row.category,
    brand: {
      "@type": "Brand",
      name: row.make
    },
    ...(image ? { image: [image] } : {}),
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "Model year",
        value: String(row.year)
      },
      {
        "@type": "PropertyValue",
        name: "Odometer",
        value: inventoryOdometerLabel(row)
      },
      {
        "@type": "PropertyValue",
        name: "Listing price",
        value: INVENTORY_CALL_FOR_PRICING
      },
      {
        "@type": "PropertyValue",
        name: "Availability",
        value: row.status
      }
    ]
  };
}

/**
 * ItemList for /inventory. List items link to unit pages only (no nested Product/Offer),
 * so Google does not expect price/review fields on the listing page.
 */
export function buildInventoryItemListJsonLd(
  rows: InventoryPublicRow[],
  options: { siteOrigin?: string } = {}
): Record<string, unknown> | null {
  const origin = options.siteOrigin ?? (hasPublicSiteOrigin() ? absoluteUrl("").replace(/\/$/, "") : "");
  if (!origin) return null;

  const elements = rows.map((row, index) => {
    const path = inventoryUnitCanonicalPath(row.id);
    return {
      "@type": "ListItem",
      position: index + 1,
      name: `${row.year} ${inventoryMakeModelTitle(row)}`,
      url: `${origin}${path}`
    };
  });

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Temptation Motorsports inventory",
    description: "Motorcycles, ATVs, snowmobiles, side-by-sides, watercraft, and trailers for sale in Edmonton.",
    numberOfItems: elements.length,
    itemListElement: elements
  };
}
