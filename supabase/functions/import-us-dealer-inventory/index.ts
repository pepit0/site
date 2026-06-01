/**
 * Selective US dealer import into inventory_import_queue.
 * Deploy: supabase functions deploy import-us-dealer-inventory
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { searchDealerSpike } from "../_shared/us-import/dealer-spike.ts";
import { searchDx1 } from "../_shared/us-import/dx1.ts";
import { searchListivo } from "../_shared/us-import/listivo.ts";
import { searchWooCommerce } from "../_shared/us-import/woocommerce.ts";
import {
  appendDealerStockNote,
  createTmsStockAllocator,
  loadAllReservedStockNumbers,
  normalizeStock,
} from "../_shared/tms-stock.ts";
import {
  US_IMPORT_SOURCES,
  VEHICLE_CATEGORIES,
  importSourceKey,
  passesQualityFilter,
  sourcesForCategory,
  type UsImportCandidate,
  type UsImportSourceConfig,
  type VehicleCategory
} from "../_shared/us-import/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

type ImportBody = {
  total: number;
  categoryCounts: Record<string, number>;
  usedOnly?: boolean;
};

type SkipReason =
  | "quality_filter"
  | "already_in_queue"
  | "already_in_catalog"
  | "source_exhausted";

const IMPORT_WALL_MS = 110_000;

function prependSourceLabel(notes: string | null, label: string | undefined): string | null {
  const name = label?.trim();
  if (!name) return notes?.trim() || null;
  const line = `US source: ${name}`;
  const prev = notes?.trim() ?? "";
  if (!prev) return line;
  if (prev.startsWith("US source:")) return prev;
  return `${line}\n${prev}`;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function parseCategoryCounts(raw: Record<string, number>): Record<VehicleCategory, number> {
  const out = Object.fromEntries(VEHICLE_CATEGORIES.map((c) => [c, 0])) as Record<VehicleCategory, number>;
  for (const cat of VEHICLE_CATEGORIES) {
    const n = raw[cat];
    out[cat] = typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }
  return out;
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

async function loadExistingKeys(supabase: SupabaseClient) {
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

  return { queueKeys };
}

async function* iterateSource(
  source: UsImportSourceConfig,
  importSource: string,
  category: VehicleCategory,
  usedOnly: boolean,
  maxYields: number,
  maxScans: number,
  seenSourceIds: Set<string>
): AsyncGenerator<UsImportCandidate> {
  const opts = {
    category,
    usedOnly,
    maxYields,
    maxScans,
    seenSourceIds,
    listPath: source.listPath,
    listConditions: source.listCondition ? [source.listCondition] : undefined,
    listExtraParams: source.listExtraParams,
    skipFirstPhoto: source.skipFirstPhoto
  };
  switch (source.adapter) {
    case "dealer_spike":
      yield* searchDealerSpike(source.baseUrl, importSource, opts);
      break;
    case "dx1":
      yield* searchDx1(
        source.baseUrl,
        importSource,
        { listPath: source.dx1ListPath, algoliaFilter: source.dx1Filter },
        opts
      );
      break;
    case "woocommerce":
      yield* searchWooCommerce(source.baseUrl, importSource, opts);
      break;
    case "listivo":
      yield* searchListivo(source.baseUrl, importSource, opts);
      break;
    default:
      break;
  }
}

async function runImport(supabase: SupabaseClient, body: ImportBody) {
  const startedAt = Date.now();
  const timedOut = () => Date.now() - startedAt > IMPORT_WALL_MS;

  const usedOnly = body.usedOnly !== false;
  const categoryCounts = parseCategoryCounts(body.categoryCounts);
  const sum = VEHICLE_CATEGORIES.reduce((s, c) => s + categoryCounts[c], 0);
  if (sum !== body.total) {
    throw new Error(`Category counts (${sum}) must equal total (${body.total}).`);
  }

  const { queueKeys } = await loadExistingKeys(supabase);
  const reservedStocks = await loadAllReservedStockNumbers(supabase);
  const tmsStock = createTmsStockAllocator(reservedStocks);
  const sources = [...US_IMPORT_SOURCES];

  const skipped: Record<SkipReason, number> = {
    quality_filter: 0,
    already_in_queue: 0,
    already_in_catalog: 0,
    source_exhausted: 0
  };
  const queuedByCategory = Object.fromEntries(VEHICLE_CATEGORIES.map((c) => [c, 0])) as Record<VehicleCategory, number>;
  const sourcesUsed = new Set<string>();
  const seenSourceIds = new Set<string>();
  let queued = 0;

  for (const category of VEHICLE_CATEGORIES) {
    if (timedOut()) break;
    const quota = categoryCounts[category];
    if (quota <= 0) continue;

    let filled = 0;
    let exhausted = true;

    for (const source of sourcesForCategory(sources, category)) {
      if (filled >= quota || timedOut()) break;
      const importSource = importSourceKey(source);
      const need = quota - filled;
      const maxYields = Math.max(need * 8, 32);
      const maxScans = Math.max(need * 40, 160);

      for await (const candidate of iterateSource(
        source,
        importSource,
        category,
        usedOnly,
        maxYields,
        maxScans,
        seenSourceIds
      )) {
        if (timedOut()) break;
        exhausted = false;
        const qKey = `${candidate.importSource}:${candidate.sourceProductId}`;

        if (queueKeys.has(qKey)) {
          skipped.already_in_queue += 1;
          continue;
        }
        if (!passesQualityFilter(candidate)) {
          skipped.quality_filter += 1;
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
            skipped.already_in_queue += 1;
          } else {
            throw new Error(upserted.message);
          }
          continue;
        }

        queueKeys.add(qKey);
        sourcesUsed.add(source.id);
        filled += 1;
        queued += 1;
        queuedByCategory[category] += 1;
        if (filled >= quota) break;
      }

      if (filled >= quota || timedOut()) break;
    }

    if (filled < quota) {
      skipped.source_exhausted += quota - filled;
    }
  }

  return {
    queued,
    byCategory: queuedByCategory,
    skipped,
    sourcesUsed: [...sourcesUsed],
    timedOut: timedOut()
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse({ ok: false, error: "Server misconfigured." }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ ok: false, error: "Sign in required." }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const {
    data: { user },
    error: userErr
  } = await userClient.auth.getUser();
  if (userErr || !user) {
    return jsonResponse({ ok: false, error: "Invalid or expired session." }, 401);
  }

  const { data: canManage, error: rpcErr } = await userClient.rpc("user_can_manage_inventory");
  if (rpcErr) {
    return jsonResponse({ ok: false, error: rpcErr.message }, 500);
  }
  if (!canManage) {
    return jsonResponse({ ok: false, error: "Inventory admin access required." }, 403);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body." }, 400);
  }

  if (!raw || typeof raw !== "object") {
    return jsonResponse({ ok: false, error: "Invalid body." }, 400);
  }

  const b = raw as Record<string, unknown>;
  const total = typeof b.total === "number" ? b.total : Number.parseInt(String(b.total ?? ""), 10);
  if (!Number.isFinite(total) || total < 1 || total > 30) {
    return jsonResponse({ ok: false, error: "Total must be between 1 and 30." }, 400);
  }

  const categoryCountsRaw = b.categoryCounts;
  if (!categoryCountsRaw || typeof categoryCountsRaw !== "object") {
    return jsonResponse({ ok: false, error: "categoryCounts is required." }, 400);
  }

  const body: ImportBody = {
    total,
    categoryCounts: categoryCountsRaw as Record<string, number>,
    usedOnly: b.usedOnly === false ? false : true
  };

  try {
    const stats = await runImport(
      createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }),
      body
    );
    return jsonResponse({ ok: true, stats });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Import failed.";
    const hint = /source_notes/i.test(msg)
      ? " Run sql/marketing/29_import_queue_source_notes.sql on Supabase."
      : "";
    return jsonResponse({ ok: false, error: `${msg}${hint}` }, 500);
  }
});
