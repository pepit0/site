import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeStockNumber } from "./inventoryStockDuplicate";

export const OVERLANDRAM_IMPORT_SOURCE = "overlandram_listivo";

const TMS_STOCK_RE = /^TMS(\d+)$/i;

export function isOverlandRamImportSource(importSource: string): boolean {
  return importSource === OVERLANDRAM_IMPORT_SOURCE;
}

export function usesTmsStock(importSource: string): boolean {
  return !isOverlandRamImportSource(importSource);
}

export function formatTmsStock(seq: number): string {
  return `TMS${String(seq).padStart(4, "0")}`;
}

export function parseTmsStockSeq(stock: string): number | null {
  const m = normalizeStockNumber(stock).match(TMS_STOCK_RE);
  if (!m?.[1]) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type StockConflict =
  | { kind: "catalog"; id: string; stock_number: string }
  | { kind: "queue"; id: string; stock_number: string };

export async function findStockConflict(
  supabase: SupabaseClient,
  stock: string,
  options?: { excludeQueueId?: string; excludeUnitId?: string }
): Promise<StockConflict | null> {
  const normalized = normalizeStockNumber(stock);
  if (!normalized) return null;

  let catalogQuery = supabase.from("inventory_units").select("id, stock_number").eq("stock_number", normalized).limit(1);
  if (options?.excludeUnitId) {
    catalogQuery = catalogQuery.neq("id", options.excludeUnitId);
  }
  const { data: catalogRow, error: catalogErr } = await catalogQuery.maybeSingle();
  if (catalogErr) throw new Error(catalogErr.message);
  if (catalogRow && typeof catalogRow.id === "string" && typeof catalogRow.stock_number === "string") {
    return { kind: "catalog", id: catalogRow.id, stock_number: catalogRow.stock_number };
  }

  let queueQuery = supabase
    .from("inventory_import_queue")
    .select("id, stock_number")
    .eq("stock_number", normalized)
    .limit(1);
  if (options?.excludeQueueId) {
    queueQuery = queueQuery.neq("id", options.excludeQueueId);
  }
  const { data: queueRow, error: queueErr } = await queueQuery.maybeSingle();
  if (queueErr) throw new Error(queueErr.message);
  if (queueRow && typeof queueRow.id === "string" && typeof queueRow.stock_number === "string") {
    return { kind: "queue", id: queueRow.id, stock_number: queueRow.stock_number };
  }

  return null;
}

export function stockConflictMessage(conflict: StockConflict, stock: string): string {
  if (conflict.kind === "catalog") {
    return `Stock #${stock} is already in the catalog.`;
  }
  return `Stock #${stock} is already assigned to another import queue row.`;
}
