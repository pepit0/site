import { inventoryMakeModelTitle, type InventoryPublicRow } from "../data/inventory";

/** CRM / chat label: year, make/model, and stock number. */
export function formatInventoryUnitInterest(row: InventoryPublicRow): string {
  const title = inventoryMakeModelTitle(row);
  return `${row.year} ${title} — Stock #${row.stock_number}`;
}
