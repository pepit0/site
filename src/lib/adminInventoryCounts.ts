import { INVENTORY_STATUS_VALUES, type InventoryStatus } from "../data/inventory";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminInventoryCounts = {
  catalog: {
    total: number;
    /** Catalog units still linked from a posted import row (matches import posted in catalog). */
    fromImport: number;
    byStatus: Record<InventoryStatus, number>;
  };
  import: {
    pending: number;
    /** All import rows ever posted to the catalog (audit log). */
    posted: number;
    /** Distinct catalog units still linked from posted import rows. */
    postedInCatalog: number;
    /** Posted rows with no catalog link (unit deleted or never linked). */
    postedRemoved: number;
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
  options?: {
    eq?: Record<string, string | boolean>;
    notNull?: string[];
    isNull?: string[];
  }
): Promise<number> {
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  if (options?.eq) {
    for (const [key, value] of Object.entries(options.eq)) {
      q = q.eq(key, value);
    }
  }
  if (options?.notNull) {
    for (const col of options.notNull) {
      q = q.not(col, "is", null);
    }
  }
  if (options?.isNull) {
    for (const col of options.isNull) {
      q = q.is(col, null);
    }
  }
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function fetchDistinctPostedImportUnitIds(supabase: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>();
  let from = 0;
  const pageSize = 1000;

  for (;;) {
    const { data, error } = await supabase
      .from("inventory_import_queue")
      .select("imported_inventory_id")
      .eq("status", "posted")
      .not("imported_inventory_id", "is", null)
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);
    if (!data?.length) break;

    for (const row of data) {
      if (typeof row.imported_inventory_id === "string") {
        ids.add(row.imported_inventory_id);
      }
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return ids;
}

async function countExistingUnitIds(supabase: SupabaseClient, ids: Set<string>): Promise<number> {
  if (ids.size === 0) return 0;

  const idList = [...ids];
  let live = 0;
  const batchSize = 200;

  for (let i = 0; i < idList.length; i += batchSize) {
    const batch = idList.slice(i, i + batchSize);
    const { data, error } = await supabase.from("inventory_units").select("id").in("id", batch);
    if (error) throw new Error(error.message);
    live += data?.length ?? 0;
  }

  return live;
}

export async function fetchAdminInventoryCounts(supabase: SupabaseClient): Promise<AdminInventoryCounts> {
  const statusCounts = await Promise.all(
    INVENTORY_STATUS_VALUES.map(async (status) => ({
      status,
      count: await exactCount(supabase, "inventory_units", { eq: { status } })
    }))
  );

  const byStatus = Object.fromEntries(statusCounts.map(({ status, count }) => [status, count])) as Record<
    InventoryStatus,
    number
  >;
  const catalogTotal = statusCounts.reduce((sum, { count }) => sum + count, 0);

  const [importPending, importPosted, importPostedOrphanRows, importSkipped, sellSubmitted, sellRejected, customer] =
    await Promise.all([
      exactCount(supabase, "inventory_import_queue", { eq: { status: "pending" } }),
      exactCount(supabase, "inventory_import_queue", { eq: { status: "posted" } }),
      exactCount(supabase, "inventory_import_queue", {
        eq: { status: "posted" },
        isNull: ["imported_inventory_id"]
      }),
      exactCount(supabase, "inventory_import_queue", { eq: { status: "skipped" } }),
      exactCount(supabase, "sell_ride_submissions", { eq: { status: "submitted" } }),
      exactCount(supabase, "sell_ride_submissions", { eq: { status: "rejected" } }),
      exactCount(supabase, "inventory_units", { eq: { is_customer_unit: true } })
    ]);

  const linkedUnitIds = await fetchDistinctPostedImportUnitIds(supabase);
  const postedInCatalog = await countExistingUnitIds(supabase, linkedUnitIds);

  return {
    catalog: { total: catalogTotal, fromImport: postedInCatalog, byStatus },
    import: {
      pending: importPending,
      posted: importPosted,
      postedInCatalog,
      postedRemoved: importPostedOrphanRows,
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
