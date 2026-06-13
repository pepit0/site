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
  schemaOfferPriceCad
} from "../lib/inventoryPublicPrice";

export { INVENTORY_CALL_FOR_PRICING } from "../lib/inventoryPublicPrice";

import { absoluteUrl, hasPublicSiteOrigin } from "../lib/siteUrl";

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

/** Offer JSON-LD only when a public list price is set (matches visible page price). */
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
    seller: inventorySeller(options.origin),
    itemCondition: "https://schema.org/UsedCondition"
  };
}

export function inventoryUnitSeoTitle(row: Pick<InventoryPublicRow, "year" | "make" | "model">): string {
  return `${row.year} ${inventoryMakeModelTitle(row)}`;
}

export function inventoryUnitSeoDescription(row: InventoryPublicRow): string {
  return `${row.year} ${inventoryMakeModelTitle(row)} — ${inventoryYearKmLine(row)}. ${row.status}. ${inventoryPublicPriceLabel(row)}. View photos at Temptation Motorsports, Edmonton.`;
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
  const offers = buildInventoryProductOffer(row, { origin, offerUrl: url });

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
    ...(offers ? { offers } : {}),
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
  origin: string,
  supabaseUrl: string | undefined
): Record<string, unknown> {
  const path = inventoryUnitCanonicalPath(row.id);
  const url = `${origin}${path}`;
  const listItem: Record<string, unknown> = {
    "@type": "ListItem",
    position: index + 1,
    name: `${row.year} ${inventoryMakeModelTitle(row)}`,
    url
  };

  const offer = buildInventoryProductOffer(row, { origin, offerUrl: url });
  if (!offer) return listItem;

  const image = supabaseUrl ? inventoryUnitPrimaryImage(row, supabaseUrl) : undefined;
  listItem.item = {
    "@type": "Product",
    name: `${row.year} ${inventoryMakeModelTitle(row)}`,
    ...(image ? { image } : {}),
    offers: offer
  };
  return listItem;
}

/**
 * ItemList for /inventory. Units without a public price are plain ListItems (no Offer).
 * Units with list_price_cad include Product/Offer so Google gets a matching price field.
 */
export function buildInventoryItemListJsonLd(
  rows: InventoryPublicRow[],
  options: { siteOrigin?: string; supabaseUrl?: string } = {}
): Record<string, unknown> | null {
  const origin = options.siteOrigin ?? (hasPublicSiteOrigin() ? absoluteUrl("").replace(/\/$/, "") : "");
  if (!origin) return null;

  const elements = rows.map((row, index) =>
    buildInventoryItemListElement(row, index, origin, options.supabaseUrl)
  );

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Temptation Motorsports inventory",
    description: "Bikes, sleds, ATVs, side-by-sides, jet skis, and trailers for sale in Edmonton. Call for price. Apply for a loan with Temptation Motorsports.",
    numberOfItems: elements.length,
    itemListElement: elements
  };
}
