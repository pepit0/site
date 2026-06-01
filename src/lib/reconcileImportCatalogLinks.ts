import { findInventoryUnitByStock, normalizeStockNumber } from "./inventoryStockDuplicate";
import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE_SIZE = 500;

/**
 * Backfill `imported_inventory_id` on posted import rows that lost their link
 * but still match a catalog unit by stock number (e.g. partial publish / timeout).
 */
export async function reconcileOrphanedImportCatalogLinks(
  supabase: SupabaseClient
): Promise<{ backfilled: number }> {
  let backfilled = 0;
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("inventory_import_queue")
      .select("id, stock_number")
      .eq("status", "posted")
      .is("imported_inventory_id", null)
      .order("updated_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    if (!data?.length) break;

    for (const row of data) {
      if (typeof row.id !== "string" || typeof row.stock_number !== "string") continue;
      const stock = normalizeStockNumber(row.stock_number);
      if (!stock) continue;

      const unit = await findInventoryUnitByStock(supabase, stock);
      if (!unit) continue;

      const { error: upErr } = await supabase
        .from("inventory_import_queue")
        .update({ imported_inventory_id: unit.id })
        .eq("id", row.id)
        .eq("status", "posted")
        .is("imported_inventory_id", null);

      if (!upErr) backfilled += 1;
    }

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return { backfilled };
}
