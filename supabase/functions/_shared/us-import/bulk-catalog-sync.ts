import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { scanDealerSpikeUsedCatalog } from "./dealer-spike.ts";
import { scanDx1UsedCatalog } from "./dx1.ts";
import {
  appendDealerStockNote,
  createTmsStockAllocator,
  loadAllReservedStockNumbers
} from "../tms-stock.ts";
import {
  US_IMPORT_SOURCES,
  importSourceKey,
  passesQualityFilter,
  type UsImportCandidate,
  type UsImportSourceConfig,
  type VehicleCategory
} from "./types.ts";

export type BulkSyncStats = {
  scanned: number;
  queued: number;
  alreadyInQueue: number;
  skippedQuality: number;
  byCategory: Record<VehicleCategory, number>;
  bySource: Record<string, number>;
  sources: string[];
};

function prependSourceLabel(notes: string | null, label: string | undefined): string | null {
  const name = label?.trim();
  if (!name) return notes?.trim() || null;
  const line = `US source: ${name}`;
  const prev = notes?.trim() ?? "";
  if (!prev) return line;
  if (prev.startsWith("US source:")) return prev;
  return `${line}\n${prev}`;
}

async function loadExistingQueueKeys(supabase: SupabaseClient): Promise<Set<string>> {
  const queueKeys = new Set<string>();
  let from = 0;
  const page = 500;
  for (;;) {
    const { data, error } = await supabase
      .from("inventory_import_queue")
      .select("import_source, source_product_id")
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    for (const r of rows) {
      if (r && typeof r.import_source === "string" && typeof r.source_product_id === "string") {
        queueKeys.add(`${r.import_source}:${r.source_product_id}`);
      }
    }
    if (rows.length < page) break;
    from += page;
  }
  return queueKeys;
}

async function queueCandidate(
  supabase: SupabaseClient,
  candidate: UsImportCandidate,
  stock: string,
  sourceNotes: string | null
): Promise<{ ok: true } | { ok: false; duplicate: boolean; message: string }> {
  const baseRow = {
    import_source: candidate.importSource,
    source_product_id: candidate.sourceProductId,
    stock_number: stock,
    year: candidate.year,
    make: candidate.make,
    model: candidate.model,
    odometer_km: candidate.odometerKm,
    category: candidate.category,
    source_photo_urls: candidate.photoUrls,
    source_permalink: candidate.permalink,
    source_product_name: candidate.title,
    status: "pending" as const
  };

  let { error } = await supabase.from("inventory_import_queue").upsert(
    { ...baseRow, source_notes: sourceNotes },
    { onConflict: "import_source,source_product_id", ignoreDuplicates: true }
  );

  if (error && /source_notes/i.test(error.message)) {
    ({ error } = await supabase.from("inventory_import_queue").upsert(baseRow, {
      onConflict: "import_source,source_product_id",
      ignoreDuplicates: true
    }));
  }

  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return { ok: false, duplicate: true, message: error.message };
    }
    return { ok: false, duplicate: false, message: error.message };
  }

  return { ok: true };
}

async function* iterateSourceCatalog(
  source: UsImportSourceConfig,
  importSource: string,
  seenSourceIds: Set<string>
): AsyncGenerator<UsImportCandidate> {
  const listConditions = source.listCondition ? [source.listCondition] : undefined;
  const scanOpts = {
    usedOnly: true,
    maxScans: 5000,
    seenSourceIds,
    listPath: source.listPath,
    listConditions,
    listExtraParams: source.listExtraParams,
    skipFirstPhoto: source.skipFirstPhoto
  };

  switch (source.adapter) {
    case "dealer_spike":
      yield* scanDealerSpikeUsedCatalog(source.baseUrl, importSource, scanOpts);
      break;
    case "dx1":
      yield* scanDx1UsedCatalog(source.baseUrl, importSource, {
        listPath: source.dx1ListPath,
        algoliaFilter: source.dx1Filter
      }, { seenSourceIds, maxScans: 5000 });
      break;
    default:
      break;
  }
}

export async function bulkSyncUsImportSources(
  supabase: SupabaseClient,
  options?: { sourceIds?: string[]; minPhotos?: number }
): Promise<BulkSyncStats> {
  const minPhotos = options?.minPhotos ?? 4;
  const sourceIds = options?.sourceIds?.length ? new Set(options.sourceIds) : null;
  const sources = US_IMPORT_SOURCES.filter((s) =>
    s.adapter === "dealer_spike" || s.adapter === "dx1"
  ).filter((s) => !sourceIds || sourceIds.has(s.id));

  const queueKeys = await loadExistingQueueKeys(supabase);
  const reservedStocks = await loadAllReservedStockNumbers(supabase);
  const tmsStock = createTmsStockAllocator(reservedStocks);
  const seenSourceIds = new Set<string>();

  const byCategory = Object.fromEntries(
    (["Motorcycle", "ATV", "Snowmobile", "Side by side", "Watercraft", "Trailer"] as VehicleCategory[]).map((c) => [c, 0])
  ) as Record<VehicleCategory, number>;
  const bySource: Record<string, number> = {};

  let scanned = 0;
  let queued = 0;
  let alreadyInQueue = 0;
  let skippedQuality = 0;

  for (const source of sources) {
    const importSource = importSourceKey(source);
    for await (const candidate of iterateSourceCatalog(source, importSource, seenSourceIds)) {
      scanned += 1;
      const qKey = `${candidate.importSource}:${candidate.sourceProductId}`;
      if (queueKeys.has(qKey)) {
        alreadyInQueue += 1;
        continue;
      }
      if (!passesQualityFilter(candidate, minPhotos)) {
        skippedQuality += 1;
        continue;
      }

      const stock = tmsStock.next();
      const sourceNotes = appendDealerStockNote(
        prependSourceLabel(candidate.sourceNotes, source.label),
        candidate.stockNumber
      );
      const upserted = await queueCandidate(supabase, candidate, stock, sourceNotes);
      if (!upserted.ok) {
        if (upserted.duplicate) {
          alreadyInQueue += 1;
          queueKeys.add(qKey);
        } else {
          throw new Error(upserted.message);
        }
        continue;
      }

      queueKeys.add(qKey);
      queued += 1;
      byCategory[candidate.category] += 1;
      bySource[source.id] = (bySource[source.id] ?? 0) + 1;
    }
  }

  return {
    scanned,
    queued,
    alreadyInQueue,
    skippedQuality,
    byCategory,
    bySource,
    sources: sources.map((s) => s.id)
  };
}
