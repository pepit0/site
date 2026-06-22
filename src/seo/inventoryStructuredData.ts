import type { InventoryPublicRow, InventoryPublicStatus } from "../data/inventory";
import {
  inventoryMakeModelTitle,
  inventoryOdometerLabel,
  inventoryYearKmLine,
  INVENTORY_PHOTOS_BUCKET
} from "../data/inventory";
import {
  inventoryPublicListPriceCad,
  inventoryPublicPriceLabel,
  schemaOfferPriceCad,
  schemaOfferPriceValidUntil
} from "../lib/inventoryPublicPrice";

export { INVENTORY_CALL_FOR_PRICING } from "../lib/inventoryPublicPrice";

import { absoluteUrl, hasPublicSiteOrigin } from "../lib/siteUrl";
import { ensureHttpsUrl } from "../lib/ensureHttpsUrl";

export const SEO_DOCUMENT_TITLE_MAX = 55;

function inventorySeller(siteOrigin: string) {
  return {
    "@type": "Organization" as const,
    name: "Temptation Motorsports",
    url: siteOrigin
  };
}

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

/** True when Product JSON-LD should be emitted (public price, not sold). */
export function inventoryRowHasProductJsonLd(row: InventoryPublicRow): boolean {
  return row.status !== "Sold" && inventoryPublicListPriceCad(row) != null;
}

/** Offer JSON-LD when a public list price is set (matches visible page price). */
export function buildInventoryProductOffer(
  row: InventoryPublicRow,
  options: { origin: string; offerUrl: string }
): Record<string, unknown> | undefined {
  const price = inventoryPublicListPriceCad(row);
  if (price == null) return undefined;

  return {
    "@type": "Offer",
    url: options.offerUrl,
    price: schemaOfferPriceCad(price),
    priceCurrency: "CAD",
    availability: inventorySchemaAvailability(row.status),
    priceValidUntil: schemaOfferPriceValidUntil(row.updated_at),
    seller: inventorySeller(options.origin),
    itemCondition: "https://schema.org/UsedCondition"
  };
}

function inventoryUnitSeoStockLabel(row: Pick<InventoryPublicRow, "stock_number">): string {
  return `Stock ${row.stock_number.trim()}`;
}

export function inventoryUnitSeoTitle(
  row: Pick<InventoryPublicRow, "year" | "make" | "model" | "stock_number">
): string {
  return `${row.year} ${inventoryMakeModelTitle(row)} · ${inventoryUnitSeoStockLabel(row)}`;
}

/** Shorter document title for SERP length (keep in sync with scripts/lib/inventory-seo.mjs). */
export function inventoryUnitSeoDocumentTitle(
  row: Pick<InventoryPublicRow, "year" | "make" | "model" | "stock_number">
): string {
  const full = inventoryUnitSeoTitle(row);
  if (full.length <= SEO_DOCUMENT_TITLE_MAX) return full;

  const stock = inventoryUnitSeoStockLabel(row);
  const ymm = `${row.year} ${inventoryMakeModelTitle(row)}`;
  const withStock = `${ymm} · ${stock}`;
  if (withStock.length <= SEO_DOCUMENT_TITLE_MAX) return withStock;

  const room = SEO_DOCUMENT_TITLE_MAX - stock.length - 3;
  if (room < 12) return `${ymm.slice(0, SEO_DOCUMENT_TITLE_MAX - 1)}…`;
  return `${ymm.slice(0, room)}… · ${stock}`;
}

export function inventoryUnitSeoDescription(row: InventoryPublicRow): string {
  return `${row.year} ${inventoryMakeModelTitle(row)} · ${inventoryUnitSeoStockLabel(row)} — ${inventoryYearKmLine(row)}. ${row.status}. ${inventoryPublicPriceLabel(row)}. View photos at Temptation Motorsports, Edmonton.`;
}

export function inventoryUnitCanonicalPath(unitId: string): string {
  return `/inventory/${unitId}`;
}

/** Absolute public URL for a stored inventory photo path. */
export function inventoryPhotoAbsoluteUrl(photoPath: string, supabaseUrl: string): string {
  const base = ensureHttpsUrl(supabaseUrl).replace(/\/+$/, "");
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

export function buildInventoryProductJsonLd(
  row: InventoryPublicRow,
  options: { supabaseUrl: string; siteOrigin?: string }
): Record<string, unknown> | null {
  if (!inventoryRowHasProductJsonLd(row)) return null;

  const origin = options.siteOrigin ?? (hasPublicSiteOrigin() ? absoluteUrl("").replace(/\/$/, "") : "");
  if (!origin) return null;

  const path = inventoryUnitCanonicalPath(row.id);
  const url = `${origin}${path}`;
  const image = inventoryUnitPrimaryImage(row, options.supabaseUrl);
  const offers = buildInventoryProductOffer(row, { origin, offerUrl: url });
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
    brand: {
      "@type": "Brand",
      name: row.make
    },
    ...(image ? { image: [image] } : {}),
    offers,
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
        value: inventoryPublicPriceLabel(row)
      },
      {
        "@type": "PropertyValue",
        name: "Availability",
        value: row.status
      }
    ]
  };
}

function buildInventoryItemListElement(
  row: InventoryPublicRow,
  index: number,
  origin: string
): Record<string, unknown> {
  const path = inventoryUnitCanonicalPath(row.id);
  const url = `${origin}${path}`;
  return {
    "@type": "ListItem",
    position: index + 1,
    name: inventoryUnitSeoTitle(row),
    url
  };
}

/**
 * ItemList for /inventory. Plain ListItem entries (no nested Product) for validator compatibility.
 */
export function buildInventoryItemListJsonLd(
  rows: InventoryPublicRow[],
  options: { siteOrigin?: string; supabaseUrl?: string } = {}
): Record<string, unknown> | null {
  const origin = options.siteOrigin ?? (hasPublicSiteOrigin() ? absoluteUrl("").replace(/\/$/, "") : "");
  if (!origin) return null;

  const elements = rows.map((row, index) => buildInventoryItemListElement(row, index, origin));

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Temptation Motorsports inventory",
    description: "Bikes, sleds, ATVs, side-by-sides, jet skis, and trailers for sale in Edmonton. Call for price. Apply for a loan with Temptation Motorsports.",
    numberOfItems: elements.length,
    itemListElement: elements
  };
}
