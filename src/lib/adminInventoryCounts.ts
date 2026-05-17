import { INVENTORY_STATUS_VALUES, type InventoryStatus } from "../data/inventory";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminInventoryCounts = {
  catalog: {
    total: number;
    byStatus: Record<InventoryStatus, number>;
  };
  import: {
    pending: number;
    posted: number;
    skipped: number;
    total: number;
  };
  sell: {
    submitted: number;
    rejected: number;
    total: number;
  };
  customer: number;
};

async function exactCount(
  supabase: SupabaseClient,
  table: "inventory_units" | "inventory_import_queue" | "sell_ride_submissions",
  filters?: Record<string, string | boolean>
): Promise<number> {
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      q = q.eq(key, value);
    }
  }
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function fetchAdminInventoryCounts(supabase: SupabaseClient): Promise<AdminInventoryCounts> {
  const statusCounts = await Promise.all(
    INVENTORY_STATUS_VALUES.map(async (status) => ({
      status,
      count: await exactCount(supabase, "inventory_units", { status })
    }))
  );

  const byStatus = Object.fromEntries(statusCounts.map(({ status, count }) => [status, count])) as Record<
    InventoryStatus,
    number
  >;
  const catalogTotal = statusCounts.reduce((sum, { count }) => sum + count, 0);

  const [importPending, importPosted, importSkipped, sellSubmitted, sellRejected, customer] = await Promise.all([
    exactCount(supabase, "inventory_import_queue", { status: "pending" }),
    exactCount(supabase, "inventory_import_queue", { status: "posted" }),
    exactCount(supabase, "inventory_import_queue", { status: "skipped" }),
    exactCount(supabase, "sell_ride_submissions", { status: "submitted" }),
    exactCount(supabase, "sell_ride_submissions", { status: "rejected" }),
    exactCount(supabase, "inventory_units", { is_customer_unit: true })
  ]);

  return {
    catalog: { total: catalogTotal, byStatus },
    import: {
      pending: importPending,
      posted: importPosted,
      skipped: importSkipped,
      total: importPending + importPosted + importSkipped
    },
    sell: {
      submitted: sellSubmitted,
      rejected: sellRejected,
      total: sellSubmitted + sellRejected
    },
    customer
  };
}

export function formatAdminCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-CA");
}
