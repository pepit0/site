import type { SupabaseClient } from "@supabase/supabase-js";

export type MsfImportSyncStats = {
  wooProducts: number;
  importedNew: number;
  alreadyPending: number;
  alreadySkipped: number;
  ignoredPosted: number;
  ignoredInCatalog: number;
  skippedUnmapped: number;
  duplicateWooInFetch: number;
  removedStale: number;
  /** Rows written to queue (new + refreshed pending/skipped). */
  upserted: number;
};

export type MsfImportSyncSummary = {
  headline: string;
  ignoredLines: string[];
  extraLines: string[];
};

export type MsfImportSyncResult =
  | { ok: true; stats: MsfImportSyncStats }
  | { ok: false; error: string };

function parseStats(raw: unknown): MsfImportSyncStats | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const n = (k: string) => (typeof s[k] === "number" && Number.isFinite(s[k]) ? (s[k] as number) : 0);
  const upserted = n("upserted");
  const importedNew = n("importedNew");
  const alreadyPending = n("alreadyPending");
  const alreadySkipped = n("alreadySkipped");
  const legacyPosted = n("skippedPosted");
  const legacyCatalog = n("skippedInCatalog");
  return {
    wooProducts: n("wooProducts"),
    importedNew,
    alreadyPending,
    alreadySkipped,
    ignoredPosted: n("ignoredPosted") || legacyPosted,
    ignoredInCatalog: n("ignoredInCatalog") || legacyCatalog,
    skippedUnmapped: n("skippedUnmapped"),
    duplicateWooInFetch: n("duplicateWooInFetch"),
    removedStale: n("removedStale"),
    upserted: upserted || importedNew + alreadyPending + alreadySkipped
  };
}

export function formatMsfImportSyncSummary(stats: MsfImportSyncStats): MsfImportSyncSummary {
  const n = stats.importedNew;
  const headline =
    n === 0
      ? "No new units added to the queue."
      : n === 1
        ? "1 new unit added to the queue."
        : `${n} new units added to the queue.`;

  const ignoredLines: string[] = [];
  if (stats.alreadyPending > 0) {
    ignoredLines.push(
      stats.alreadyPending === 1
        ? "1 already in pending (left unchanged)"
        : `${stats.alreadyPending} already in pending (left unchanged)`
    );
  }
  if (stats.alreadySkipped > 0) {
    ignoredLines.push(
      stats.alreadySkipped === 1
        ? "1 already skipped in queue (left unchanged)"
        : `${stats.alreadySkipped} already skipped in queue (left unchanged)`
    );
  }
  if (stats.ignoredPosted > 0) {
    ignoredLines.push(
      stats.ignoredPosted === 1
        ? "1 already posted to catalog (ignored)"
        : `${stats.ignoredPosted} already posted to catalog (ignored)`
    );
  }
  if (stats.ignoredInCatalog > 0) {
    ignoredLines.push(
      stats.ignoredInCatalog === 1
        ? "1 already in catalog as MSF-* (ignored)"
        : `${stats.ignoredInCatalog} already in catalog as MSF-* (ignored)`
    );
  }

  const extraLines: string[] = [];
  if (stats.removedStale > 0) {
    extraLines.push(
      stats.removedStale === 1
        ? "Removed 1 stale pending row that was already on the catalog."
        : `Removed ${stats.removedStale} stale pending rows that were already on the catalog.`
    );
  }

  return { headline, ignoredLines, extraLines };
}

/** Calls Supabase Edge Function `sync-msf-import-queue` (inventory admin session required). */
export async function syncMsfImportQueue(supabase: SupabaseClient): Promise<MsfImportSyncResult> {
  const { data, error } = await supabase.functions.invoke("sync-msf-import-queue", { method: "POST" });
  if (error) {
    return { ok: false, error: error.message };
  }
  const body = data as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Empty response from sync." };
  }
  if (body.ok !== true) {
    const err = typeof body.error === "string" ? body.error : "Sync failed.";
    return { ok: false, error: err };
  }
  const stats = parseStats(body.stats);
  if (!stats) {
    return { ok: false, error: "Invalid sync response." };
  }
  return { ok: true, stats };
}
