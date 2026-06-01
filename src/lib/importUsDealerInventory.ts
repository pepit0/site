import type { VehicleCategory } from "../data/inventory";
import { VEHICLE_CATEGORIES } from "../data/inventory";
import { FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";

export type UsImportCategoryCounts = Record<VehicleCategory, number>;

export type UsImportStats = {
  queued: number;
  byCategory: Record<string, number>;
  skipped: {
    quality_filter: number;
    already_in_queue: number;
    already_in_catalog: number;
    source_exhausted: number;
  };
  sourcesUsed: string[];
  timedOut?: boolean;
};

export type UsImportSummary = {
  headline: string;
  detailLines: string[];
  warningLines: string[];
};

export type UsImportResult = { ok: true; stats: UsImportStats } | { ok: false; error: string };

function emptyCategoryCounts(): UsImportCategoryCounts {
  return Object.fromEntries(VEHICLE_CATEGORIES.map((c) => [c, 0])) as UsImportCategoryCounts;
}

export function createEmptyUsCategoryCounts(): UsImportCategoryCounts {
  return emptyCategoryCounts();
}

export function sumCategoryCounts(counts: UsImportCategoryCounts): number {
  return VEHICLE_CATEGORIES.reduce((s, c) => s + (counts[c] ?? 0), 0);
}

function parseStats(raw: unknown): UsImportStats | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const n = (k: string) => (typeof s[k] === "number" && Number.isFinite(s[k]) ? (s[k] as number) : 0);
  const skippedRaw = s.skipped;
  const skippedObj = skippedRaw && typeof skippedRaw === "object" ? (skippedRaw as Record<string, unknown>) : {};
  const sn = (k: string) =>
    typeof skippedObj[k] === "number" && Number.isFinite(skippedObj[k] as number) ? (skippedObj[k] as number) : 0;
  const skipped = {
    quality_filter: sn("quality_filter"),
    already_in_queue: sn("already_in_queue"),
    already_in_catalog: sn("already_in_catalog"),
    source_exhausted: sn("source_exhausted")
  };
  const byCategory =
    s.byCategory && typeof s.byCategory === "object" ? (s.byCategory as Record<string, number>) : {};
  const sourcesUsed = Array.isArray(s.sourcesUsed)
    ? s.sourcesUsed.filter((x): x is string => typeof x === "string")
    : [];
  const timedOut = s.timedOut === true;
  return { queued: n("queued"), byCategory, skipped, sourcesUsed, timedOut };
}

export function formatUsImportSummary(stats: UsImportStats, requestedTotal: number): UsImportSummary {
  const headline =
    stats.queued === 0
      ? "No US units added to the queue."
      : stats.queued === 1
        ? "1 US unit added to the queue."
        : `${stats.queued} US units added to the queue.`;

  const detailLines: string[] = [];
  for (const cat of VEHICLE_CATEGORIES) {
    const q = stats.byCategory[cat] ?? 0;
    if (q > 0) detailLines.push(`${cat}: ${q}`);
  }

  const warningLines: string[] = [];
  if (stats.queued < requestedTotal) {
    warningLines.push(`Requested ${requestedTotal}, queued ${stats.queued}.`);
  }
  if (stats.skipped.quality_filter > 0) {
    warningLines.push(`${stats.skipped.quality_filter} skipped (missing fields or fewer than 5 photos).`);
  }
  if (stats.skipped.already_in_queue > 0) {
    warningLines.push(`${stats.skipped.already_in_queue} already in import queue.`);
  }
  if (stats.skipped.already_in_catalog > 0) {
    warningLines.push(`${stats.skipped.already_in_catalog} already in catalog.`);
  }
  if (stats.skipped.source_exhausted > 0) {
    warningLines.push(`${stats.skipped.source_exhausted} not found (sources exhausted for requested mix).`);
  }
  if (stats.timedOut) {
    warningLines.push("Import stopped early (time limit). Retry for remaining units or use a smaller batch.");
  }
  if (stats.sourcesUsed.length > 0) {
    warningLines.push(`Sources: ${stats.sourcesUsed.join(", ")}.`);
  }

  return { headline, detailLines, warningLines };
}

async function parseFunctionInvokeError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as Record<string, unknown> | null;
      if (body && typeof body.error === "string" && body.error.trim()) {
        return body.error;
      }
    } catch {
      /* response body not JSON */
    }
    return error.message;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "US import failed.";
}

export async function importUsDealerInventory(
  supabase: SupabaseClient,
  options: { total: number; categoryCounts: UsImportCategoryCounts; usedOnly?: boolean }
): Promise<UsImportResult> {
  const { data, error } = await supabase.functions.invoke("import-us-dealer-inventory", {
    method: "POST",
    body: {
      total: options.total,
      categoryCounts: options.categoryCounts,
      usedOnly: options.usedOnly !== false
    }
  });

  if (error) {
    const detail = await parseFunctionInvokeError(error);
    if (/504|546|timeout|timed out|non-2xx/i.test(detail)) {
      return {
        ok: false,
        error:
          "US import timed out. Try fewer units (e.g. 3–5) or a narrower category mix, then retry."
      };
    }
    if (/source_notes/.test(detail)) {
      return {
        ok: false,
        error:
          "Database missing source_notes column. Run sql/marketing/29_import_queue_source_notes.sql on Supabase, then retry."
      };
    }
    return { ok: false, error: detail };
  }

  const body = data as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Empty response from US import." };
  }
  if (body.ok !== true) {
    const err = typeof body.error === "string" ? body.error : "US import failed.";
    return { ok: false, error: err };
  }

  const stats = parseStats(body.stats);
  if (!stats) {
    return { ok: false, error: "Invalid US import response." };
  }

  return { ok: true, stats };
}
