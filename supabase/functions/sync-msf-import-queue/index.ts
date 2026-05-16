/**
 * Sync motorsportsfinancing.ca WooCommerce products into inventory_import_queue.
 * Deploy: supabase functions deploy sync-msf-import-queue
 * Secrets: SUPABASE_SERVICE_ROLE_KEY (auto), SUPABASE_ANON_KEY (auto)
 *
 * Invoked from admin UI (inventory admin JWT). Same rules as scripts/msf-fetch-inventory-queue.mjs:
 * - Upsert only brand-new Woo products (existing pending/skipped rows are left untouched — preserves queue order)
 * - Upsert on (import_source, source_product_id) — no duplicate queue rows per Woo product
 * - Skip queue rows already posted; skip MSF-* already on catalog
 * - Dedupe photo URLs per product; drop first gallery image (studio tile)
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const IMPORT_SOURCE = "motorsportsfinancing_wc";
const STORE_BASE = "https://motorsportsfinancing.ca/wp-json/wc/store/v1/products";
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

function firstString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t || null;
  }
  return null;
}

function attrTerm(attrs: unknown, ...names: string[]): string | null {
  if (!Array.isArray(attrs)) return null;
  const want = names.map((n) => n.toLowerCase());
  for (const a of attrs) {
    if (!a || typeof a !== "object") continue;
    const o = a as Record<string, unknown>;
    const n = firstString(o.name);
    if (!n || !want.includes(n.toLowerCase())) continue;
    const terms = o.terms;
    if (!Array.isArray(terms) || terms.length < 1) continue;
    const t0 = terms[0];
    if (!t0 || typeof t0 !== "object") continue;
    return firstString((t0 as Record<string, unknown>).name);
  }
  return null;
}

function mapCategory(cats: unknown): string {
  if (!Array.isArray(cats)) return "Motorcycle";
  const list = cats
    .filter((c) => c && typeof c === "object")
    .map((c) => {
      const o = c as Record<string, unknown>;
      return {
        slug: (firstString(o.slug) ?? "").toLowerCase(),
        name: (firstString(o.name) ?? "").toLowerCase()
      };
    });

  const matchSlug = (...slugs: string[]) => list.some((c) => slugs.includes(c.slug));

  if (matchSlug("side-by-side", "side_by_side", "side-by-sides")) return "Side by side";
  if (matchSlug("atv", "atvs")) return "ATV";
  if (matchSlug("snowmobile", "snowmobiles")) return "Snowmobile";
  if (matchSlug("motorcycle", "motorcycles")) return "Motorcycle";
  if (matchSlug("marine", "watercraft", "jetski", "jetskis", "pontoon", "pontoons", "boat", "boats")) {
    return "Watercraft";
  }

  for (const c of list) {
    const s = c.slug;
    const n = c.name;
    if (s.includes("side") && s.includes("side")) return "Side by side";
    if (n.includes("side by side") || n.includes("side-by-side")) return "Side by side";
    if (s.includes("atv") || n === "atv") return "ATV";
    if (s.includes("snowmobile") || n.includes("snowmobile")) return "Snowmobile";
    if (s.includes("motorcycle") || n.includes("motorcycle")) return "Motorcycle";
    if (s.includes("marine") || s.includes("water") || n.includes("marine") || n.includes("jetski")) {
      return "Watercraft";
    }
  }
  return "Motorcycle";
}

function dedupePhotoUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const n = u.trim();
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function mapProduct(p: unknown): Omit<QueueRow, "status"> | null {
  if (!p || typeof p !== "object") return null;
  const o = p as Record<string, unknown>;
  const id = o.id;
  const pid =
    typeof id === "number" && Number.isFinite(id) ? String(id) : typeof id === "string" ? id.trim() : null;
  if (!pid) return null;

  const yearStr = attrTerm(o.attributes, "Year");
  const year = yearStr ? Number.parseInt(yearStr.replace(/\D/g, ""), 10) : NaN;
  const kmStr = attrTerm(o.attributes, "Kilometers", "Kilometer", "Odometer", "Mileage");
  let odometer_km: number | null = null;
  if (kmStr) {
    const k = Number.parseInt(kmStr.replace(/[^\d]/g, ""), 10);
    if (Number.isFinite(k) && k >= 0) odometer_km = k;
  }

  const urls: string[] = [];
  if (Array.isArray(o.images)) {
    for (const im of o.images) {
      if (!im || typeof im !== "object") continue;
      const src = firstString((im as Record<string, unknown>).src);
      if (src) urls.push(src);
    }
  }
  let photoUrls = dedupePhotoUrls(urls);
  if (photoUrls.length > 0) photoUrls = photoUrls.slice(1);

  return {
    import_source: IMPORT_SOURCE,
    source_product_id: pid,
    stock_number: `MSF-${pid}`,
    year: Number.isFinite(year) && year >= 1900 && year <= 2100 ? year : null,
    make: attrTerm(o.attributes, "Make"),
    model: attrTerm(o.attributes, "Model"),
    odometer_km,
    category: mapCategory(o.categories),
    source_photo_urls: photoUrls,
    source_permalink: firstString(o.permalink),
    source_product_name: firstString(o.name)
  };
}

async function fetchJson(url: string) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`MSF store API HTTP ${res.status}`);
  const total = res.headers.get("X-WP-Total");
  const totalPages = res.headers.get("X-WP-TotalPages");
  const data = await res.json();
  return {
    data,
    total: total ? Number.parseInt(total, 10) : null,
    totalPages: totalPages ? Number.parseInt(totalPages, 10) : null
  };
}

async function loadQueueStatusByPid(supabase: SupabaseClient): Promise<Map<string, string>> {
  const statusByPid = new Map<string, string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("inventory_import_queue")
      .select("source_product_id,status")
      .eq("import_source", IMPORT_SOURCE)
      .order("source_product_id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    for (const r of rows) {
      if (r && typeof r.source_product_id === "string" && typeof r.status === "string") {
        statusByPid.set(r.source_product_id, r.status);
      }
    }
    if (rows.length < pageSize) break;
  }
  return statusByPid;
}

async function loadCatalogMsfStockNumbers(supabase: SupabaseClient): Promise<Set<string>> {
  const set = new Set<string>();
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("inventory_units")
      .select("stock_number")
      .like("stock_number", "MSF-%")
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    for (const r of rows) {
      if (r && typeof r.stock_number === "string") set.add(r.stock_number.trim());
    }
    if (rows.length < page) break;
    from += page;
  }
  return set;
}

async function runSync(supabase: SupabaseClient) {
  const statusByPid = await loadQueueStatusByPid(supabase);
  const catalogMsfStocks = await loadCatalogMsfStockNumbers(supabase);

  const firstUrl = `${STORE_BASE}?per_page=${PER_PAGE}&page=1`;
  const { data: firstPage, total, totalPages } = await fetchJson(firstUrl);
  if (!Array.isArray(firstPage)) throw new Error("Unexpected MSF store API response");

  const reportedPages =
    totalPages && Number.isFinite(totalPages) && totalPages > 0
      ? totalPages
      : total && Number.isFinite(total) && total > 0
        ? Math.ceil(total / PER_PAGE)
        : 1;

  const allProducts: unknown[] = [...firstPage];
  for (let page = 2; page <= reportedPages; page++) {
    const { data } = await fetchJson(`${STORE_BASE}?per_page=${PER_PAGE}&page=${page}`);
    if (Array.isArray(data) && data.length) allProducts.push(...data);
    await new Promise((r) => setTimeout(r, 150));
  }

  const byPid = new Map<string, QueueRow>();
  let importedNew = 0;
  let alreadyPending = 0;
  let alreadySkipped = 0;
  let ignoredPosted = 0;
  let ignoredInCatalog = 0;
  let skippedUnmapped = 0;
  let duplicateWooInFetch = 0;

  for (const p of allProducts) {
    const mapped = mapProduct(p);
    if (!mapped) {
      skippedUnmapped += 1;
      continue;
    }
    if (byPid.has(mapped.source_product_id)) {
      duplicateWooInFetch += 1;
    }
    const st = statusByPid.get(mapped.source_product_id);
    if (st === "posted") {
      ignoredPosted += 1;
      continue;
    }
    if (catalogMsfStocks.has(mapped.stock_number)) {
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
    byPid.set(mapped.source_product_id, {
      ...mapped,
      status: "pending"
    });
  }

  const toUpsert = [...byPid.values()];
  const chunk = 80;
  for (let i = 0; i < toUpsert.length; i += chunk) {
    const part = toUpsert.slice(i, i + chunk);
    const { error } = await supabase.from("inventory_import_queue").upsert(part, {
      onConflict: "import_source,source_product_id"
    });
    if (error) throw new Error(error.message);
  }

  let removedStale = 0;
  if (catalogMsfStocks.size > 0) {
    const stocks = [...catalogMsfStocks];
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

  return {
    wooProducts: allProducts.length,
    importedNew,
    alreadyPending,
    alreadySkipped,
    ignoredPosted,
    ignoredInCatalog,
    skippedUnmapped,
    duplicateWooInFetch,
    removedStale,
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
