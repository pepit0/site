import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const OVERLANDRAM_IMPORT_SOURCE = "overlandram_listivo";

const TMS_STOCK_RE = /^TMS(\d+)$/i;

export function normalizeStock(raw: string): string {
  return raw.trim().toUpperCase();
}

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
  const m = normalizeStock(stock).match(TMS_STOCK_RE);
  if (!m?.[1]) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function createTmsStockAllocator(reserved: Set<string>) {
  let seq = 1;
  for (const raw of reserved) {
    const n = parseTmsStockSeq(raw);
    if (n != null && n >= seq) seq = n + 1;
  }

  return {
    next(): string {
      for (;;) {
        const candidate = formatTmsStock(seq);
        seq += 1;
        const normalized = normalizeStock(candidate);
        if (!reserved.has(normalized)) {
          reserved.add(normalized);
          return normalized;
        }
      }
    }
  };
}

export async function loadAllReservedStockNumbers(supabase: SupabaseClient): Promise<Set<string>> {
  const reserved = new Set<string>();
  const page = 500;

  for (const table of ["inventory_import_queue", "inventory_units"] as const) {
    let from = 0;
    for (;;) {
      const { data, error } = await supabase.from(table).select("stock_number").range(from, from + page - 1);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      for (const r of rows) {
        if (r && typeof r.stock_number === "string" && r.stock_number.trim()) {
          reserved.add(normalizeStock(r.stock_number));
        }
      }
      if (rows.length < page) break;
      from += page;
    }
  }

  return reserved;
}

export function appendDealerStockNote(
  sourceNotes: string | null,
  dealerStock: string | null | undefined
): string | null {
  const stock = dealerStock?.trim();
  if (!stock) return sourceNotes?.trim() || null;
  const line = `Dealer stock: ${stock}`;
  const prev = sourceNotes?.trim() ?? "";
  if (!prev) return line;
  if (prev.includes(line) || prev.includes(`Dealer stock: ${stock}`)) return prev;
  return `${prev}\n${line}`;
}
