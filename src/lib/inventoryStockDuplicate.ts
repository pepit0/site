import type { SupabaseClient } from "@supabase/supabase-js";

export type StockDuplicateMatch = {
  id: string;
  stock_number: string;
};

export function normalizeStockNumber(stock: string): string {
  return stock.trim().toUpperCase();
}

export function isStockNumberUniqueViolation(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("inventory_units_stock_number_key") ||
    lower.includes("duplicate key") && lower.includes("stock")
  );
}

export async function findInventoryUnitByStock(
  supabase: SupabaseClient,
  stock: string,
  excludeUnitId?: string | null
): Promise<StockDuplicateMatch | null> {
  const normalized = normalizeStockNumber(stock);
  if (!normalized) return null;

  let query = supabase.from("inventory_units").select("id, stock_number").eq("stock_number", normalized).limit(1);

  if (excludeUnitId) {
    query = query.neq("id", excludeUnitId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || typeof data.id !== "string" || typeof data.stock_number !== "string") return null;
  return { id: data.id, stock_number: data.stock_number };
}
