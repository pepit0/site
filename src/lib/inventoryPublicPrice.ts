import type { InventoryPublicRow } from "../data/inventory";

export const INVENTORY_CALL_FOR_PRICING = "Call for pricing";

/** Parse optional CAD list price from Supabase (inventory_units / inventory_units_public). */
export function parseInventoryListPriceCad(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function inventoryPublicListPriceCad(
  row: Pick<InventoryPublicRow, "list_price_cad">
): number | null {
  return parseInventoryListPriceCad(row.list_price_cad);
}

export function formatInventoryPriceCad(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0
  }).format(amount);
}

/** Visible price on cards, detail pages, and SEO copy. */
export function inventoryPublicPriceLabel(row: Pick<InventoryPublicRow, "list_price_cad">): string {
  const price = inventoryPublicListPriceCad(row);
  return price != null ? formatInventoryPriceCad(price) : INVENTORY_CALL_FOR_PRICING;
}

/** Schema.org Offer.price — string with two decimal places. */
export function schemaOfferPriceCad(amount: number): string {
  return amount.toFixed(2);
}
