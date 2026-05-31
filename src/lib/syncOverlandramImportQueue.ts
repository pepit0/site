import type { SupabaseClient } from "@supabase/supabase-js";

export type OverlandramImportSyncStats = {
  listivoListings: number;
  mappedNonAuto: number;
  skippedAuto: number;
  importedNew: number;
  alreadyPending: number;
  alreadySkipped: number;
  ignoredPosted: number;
  ignoredInCatalog: number;
  removedStale: number;
  removedPendingOffFeed: number;
  upserted: number;
};

export type OverlandramImportSyncSummary = {
  headline: string;
  ignoredLines: string[];
  extraLines: string[];
};

export type OverlandramImportSyncResult =
  | { ok: true; stats: OverlandramImportSyncStats }
  | { ok: false; error: string };

function parseStats(raw: unknown): OverlandramImportSyncStats | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const n = (k: string) => (typeof s[k] === "number" && Number.isFinite(s[k]) ? (s[k] as number) : 0);
  const upserted = n("upserted");
  const importedNew = n("importedNew");
  return {
    listivoListings: n("listivoListings"),
    mappedNonAuto: n("mappedNonAuto"),
    skippedAuto: n("skippedAuto"),
    importedNew,
    alreadyPending: n("alreadyPending"),
    alreadySkipped: n("alreadySkipped"),
    ignoredPosted: n("ignoredPosted"),
    ignoredInCatalog: n("ignoredInCatalog"),
    removedStale: n("removedStale"),
    removedPendingOffFeed: n("removedPendingOffFeed"),
    upserted: upserted || importedNew
  };
}

export function formatOverlandramImportSyncSummary(stats: OverlandramImportSyncStats): OverlandramImportSyncSummary {
  const n = stats.importedNew;
  const headline =
    n === 0
      ? "No new units added to the queue."
      : n === 1
        ? "1 new unit added to the queue."
        : `${n} new units added to the queue.`;

  const ignoredLines: string[] = [];
  if (stats.skippedAuto > 0) {
    ignoredLines.push(
      stats.skippedAuto === 1
        ? "1 Auto listing skipped"
        : `${stats.skippedAuto} Auto listings skipped`
    );
  }
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
        ? "1 already in catalog (ignored)"
        : `${stats.ignoredInCatalog} already in catalog (ignored)`
    );
  }

  const extraLines: string[] = [];
  if (stats.removedStale > 0) {
    extraLines.push(
      stats.removedStale === 1
        ? "Removed 1 stale pending row already on the catalog."
        : `Removed ${stats.removedStale} stale pending rows already on the catalog.`
    );
  }
  if (stats.removedPendingOffFeed > 0) {
    extraLines.push(
      stats.removedPendingOffFeed === 1
        ? "Removed 1 pending row no longer on Overland RAM."
        : `Removed ${stats.removedPendingOffFeed} pending rows no longer on Overland RAM.`
    );
  }

  return { headline, ignoredLines, extraLines };
}

/** Calls Supabase Edge Function `sync-overlandram-import-queue` (inventory admin session required). */
export async function syncOverlandramImportQueue(
  supabase: SupabaseClient
): Promise<OverlandramImportSyncResult> {
  const { data, error } = await supabase.functions.invoke("sync-overlandram-import-queue", { method: "POST" });
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
