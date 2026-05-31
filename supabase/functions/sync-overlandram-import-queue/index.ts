/**
 * Sync overlandram.ca Listivo listings (non-Auto) into inventory_import_queue.
 * Deploy: supabase functions deploy sync-overlandram-import-queue
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const IMPORT_SOURCE = "overlandram_listivo";
const LISTIVO_API_BASE = "https://www.overlandram.ca/wp-json/wp/v2/listings";
const PER_PAGE = 100;

type QueueRow = {
  import_source: string;
  source_product_id: string;
  stock_number: string;
  year: number | null;
  make: string | null;
  model: string | null;
  odometer_km: number | null;
  category: string;
  source_photo_urls: string[];
  source_permalink: string | null;
  source_product_name: string | null;
  status: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function firstTerm(v: unknown): string | null {
  if (!Array.isArray(v) || v.length < 1) return null;
  const t = v[0];
  return typeof t === "string" && t.trim() ? t.trim() : null;
}

function parseOdometerKm(raw: unknown): number | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/[^\d]/g, "");
  if (!digits) return null;
  const k = Number.parseInt(digits, 10);
  return Number.isFinite(k) && k >= 0 ? k : null;
}

function parseYear(raw: unknown): number | null {
  if (raw == null) return null;
  const y = Number.parseInt(String(raw).replace(/\D/g, ""), 10);
  return Number.isFinite(y) && y >= 1900 && y <= 2100 ? y : null;
}

function mapListivoCategory(type: string | null | undefined, subtype: string | null | undefined): string {
  const s = (subtype ?? "").toLowerCase();
  const t = (type ?? "").toLowerCase();
  if (s.includes("side-by-side") || s === "sxs") return "Side by side";
  if (s === "atv") return "ATV";
  if (s.includes("snowmobile")) return "Snowmobile";
  if (s.includes("motorcycle")) return "Motorcycle";
  if (s.includes("watercraft") || s === "pwc") return "Watercraft";
  if (s.includes("travel trailer") || s.includes("trailer")) return "Trailer";
  if (t === "marine") return "Watercraft";
  if (t === "rv" || t === "utility trailer") return "Trailer";
  if (t === "motorsport") return "ATV";
  return "Motorcycle";
}

function dedupePhotoUrls(urls: unknown): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  if (!Array.isArray(urls)) return out;
  for (const u of urls) {
    if (typeof u !== "string" || !u.trim()) continue;
    const n = u.trim();
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function mapListivoListing(row: unknown): QueueRow | null {
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const id = o.id;
  const pid = typeof id === "number" && Number.isFinite(id) ? String(id) : typeof id === "string" ? id : null;
  if (!pid) return null;

  const inventoryType = firstTerm(o.listivo_14);
  if (inventoryType?.toLowerCase() === "auto") return null;

  const subtype = firstTerm(o.listivo_8359);
  const make = firstTerm(o.listivo_945);
  const model = firstTerm(o.listivo_946);
  const year = parseYear(firstTerm(o.listivo_4316));
  const odometer_km = parseOdometerKm(firstTerm(o.listivo_4686));
  const dealerStock = firstTerm(o.listivo_8113);
  const stock_number = dealerStock || `OVR-${pid}`;

  const titleObj = o.title;
  let source_product_name: string | null = null;
  if (titleObj && typeof titleObj === "object") {
    const rendered = (titleObj as Record<string, unknown>).rendered;
    if (typeof rendered === "string" && rendered.trim()) source_product_name = rendered.trim();
  }

  const link = typeof o.link === "string" && o.link.trim() ? o.link.trim() : null;

  return {
    import_source: IMPORT_SOURCE,
    source_product_id: pid,
    stock_number,
    year,
    make,
    model,
    odometer_km,
    category: mapListivoCategory(inventoryType, subtype),
    source_photo_urls: dedupePhotoUrls(o.listivo_145),
    source_permalink: link,
    source_product_name,
    status: "pending"
  };
}

async function fetchListingsPage(page: number) {
  const url = `${LISTIVO_API_BASE}?per_page=${PER_PAGE}&page=${page}&status=publish`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching Listivo listings`);
  const total = res.headers.get("X-WP-Total");
  const totalPages = res.headers.get("X-WP-TotalPages");
  const data = await res.json();
  return {
    data,
    total: total ? Number.parseInt(total, 10) : null,
    totalPages: totalPages ? Number.parseInt(totalPages, 10) : null
  };
}

async function loadCatalogStockNumbers(supabase: SupabaseClient, stocks: Set<string>): Promise<Set<string>> {
  const found = new Set<string>();
  if (stocks.size === 0) return found;
  const list = [...stocks];
  const chunk = 80;
  for (let i = 0; i < list.length; i += chunk) {
    const part = list.slice(i, i + chunk);
    const { data, error } = await supabase.from("inventory_units").select("stock_number").in("stock_number", part);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      if (r && typeof r.stock_number === "string") found.add(r.stock_number.trim());
    }
  }
  return found;
}

async function removePendingOffFeed(supabase: SupabaseClient, activePids: Set<string>): Promise<number> {
  let removed = 0;
  const page = 500;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from("inventory_import_queue")
      .select("id, source_product_id")
      .eq("import_source", IMPORT_SOURCE)
      .eq("status", "pending")
      .order("id", { ascending: true })
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    if (rows.length === 0) break;

    const staleIds = rows
      .filter((r) => r && typeof r.source_product_id === "string" && !activePids.has(r.source_product_id))
      .map((r) => r.id)
      .filter((id): id is string => typeof id === "string");

    if (staleIds.length > 0) {
      const ch = 80;
      for (let i = 0; i < staleIds.length; i += ch) {
        const part = staleIds.slice(i, i + ch);
        const { data: delRows, error: delErr } = await supabase
          .from("inventory_import_queue")
          .delete()
          .in("id", part)
          .select("id");
        if (delErr) throw new Error(delErr.message);
        removed += delRows?.length ?? 0;
      }
    }

    if (rows.length < page) break;
  }
  return removed;
}

async function runSync(supabase: SupabaseClient) {
  const statusByPid = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("inventory_import_queue")
      .select("source_product_id,status")
      .eq("import_source", IMPORT_SOURCE)
      .order("source_product_id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    for (const r of rows) {
      if (r && typeof r.source_product_id === "string" && typeof r.status === "string") {
        statusByPid.set(r.source_product_id, r.status);
      }
    }
    if (rows.length < 1000) break;
  }

  const { data: firstPage, total, totalPages } = await fetchListingsPage(1);
  if (!Array.isArray(firstPage)) throw new Error("Unexpected Listivo API response");

  const pages =
    totalPages && Number.isFinite(totalPages) && totalPages > 0
      ? totalPages
      : total && Number.isFinite(total) && total > 0
        ? Math.ceil(total / PER_PAGE)
        : 1;

  const allListings: unknown[] = [...firstPage];
  for (let page = 2; page <= pages; page++) {
    const { data } = await fetchListingsPage(page);
    if (Array.isArray(data) && data.length) allListings.push(...data);
    await new Promise((r) => setTimeout(r, 120));
  }

  const activePids = new Set<string>();
  let skippedAuto = 0;
  const mapped: QueueRow[] = [];
  for (const row of allListings) {
    const m = mapListivoListing(row);
    if (!m) {
      const o = row && typeof row === "object" ? (row as Record<string, unknown>) : null;
      const typeArr = o?.listivo_14;
      const type = Array.isArray(typeArr) && typeof typeArr[0] === "string" ? typeArr[0].toLowerCase() : "";
      if (type === "auto") skippedAuto += 1;
      continue;
    }
    activePids.add(m.source_product_id);
    mapped.push(m);
  }

  const catalogStocks = await loadCatalogStockNumbers(supabase, new Set(mapped.map((m) => m.stock_number)));

  const toUpsert: QueueRow[] = [];
  let importedNew = 0;
  let alreadyPending = 0;
  let alreadySkipped = 0;
  let ignoredPosted = 0;
  let ignoredInCatalog = 0;

  for (const m of mapped) {
    const st = statusByPid.get(m.source_product_id);
    if (st === "posted") {
      ignoredPosted += 1;
      continue;
    }
    if (catalogStocks.has(m.stock_number)) {
      ignoredInCatalog += 1;
      continue;
    }
    if (st === "pending") {
      alreadyPending += 1;
      continue;
    }
    if (st === "skipped") {
      alreadySkipped += 1;
      continue;
    }
    importedNew += 1;
    toUpsert.push({ ...m, status: "pending" });
  }

  const chunk = 80;
  for (let i = 0; i < toUpsert.length; i += chunk) {
    const part = toUpsert.slice(i, i + chunk);
    const { error } = await supabase.from("inventory_import_queue").upsert(part, {
      onConflict: "import_source,source_product_id"
    });
    if (error) throw new Error(error.message);
  }

  let removedStale = 0;
  if (catalogStocks.size > 0) {
    const stocks = [...catalogStocks];
    const ch = 100;
    for (let i = 0; i < stocks.length; i += ch) {
      const part = stocks.slice(i, i + ch);
      const { data: delRows, error: delErr } = await supabase
        .from("inventory_import_queue")
        .delete()
        .eq("import_source", IMPORT_SOURCE)
        .eq("status", "pending")
        .in("stock_number", part)
        .select("id");
      if (delErr) throw new Error(delErr.message);
      removedStale += delRows?.length ?? 0;
    }
  }

  const removedPendingOffFeed = await removePendingOffFeed(supabase, activePids);

  return {
    listivoListings: allListings.length,
    mappedNonAuto: mapped.length,
    skippedAuto,
    importedNew,
    alreadyPending,
    alreadySkipped,
    ignoredPosted,
    ignoredInCatalog,
    removedStale,
    removedPendingOffFeed,
    upserted: toUpsert.length
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
    return jsonResponse({ ok: false, error: "Server misconfigured (missing Supabase env)." }, 500);
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

  try {
    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const stats = await runSync(serviceClient);
    return jsonResponse({ ok: true, error: null, stats });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed.";
    return jsonResponse({ ok: false, error: msg }, 500);
  }
});
