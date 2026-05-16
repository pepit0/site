/**
 * Fetches all products from motorsportsfinancing.ca (WooCommerce Store API)
 * and upserts rows into Supabase `inventory_import_queue`.
 *
 * Env (project root — loaded in order `.env` then `.env.local`, local overrides):
 *   SUPABASE_URL or VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (or aliases: SUPABASE_SERVICE_KEY, SERVICE_ROLE_KEY, SUPABASE_SECRET)
 *
 * Usage: npm run msf:queue
 *
 * Re-runs: updates pending/skipped rows with fresh Woo data; leaves `posted` rows untouched.
 *
 * New Woo products (new numeric IDs) get new queue rows. Same Woo id upserts one row (no duplicate queue rows).
 * Skips queue upsert when `inventory_units` already has stock_number `MSF-{wooId}` (already on your catalog).
 *
 * Photo URLs: duplicate URLs removed; Woo’s first gallery image is dropped (studio tile is usually first).
 *
 * Trim pending rows once without SQL: `npm run msf:trim-first` (same env as msf:queue).
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const IMPORT_SOURCE = "motorsportsfinancing_wc";
const STORE_BASE = "https://motorsportsfinancing.ca/wp-json/wc/store/v1/products";
const PER_PAGE = 100;

function readEnvFileRaw(p) {
  const buf = readFileSync(p);
  // UTF-16 LE with BOM (Notepad "Unicode") — parsing as UTF-8 breaks keys/values.
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return { text: buf.subarray(2).toString("utf16le"), encoding: "utf-16le" };
  }
  let text = buf.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return { text, encoding: "utf-8" };
}

function loadEnvFiles() {
  // `.env` first, then `.env.local` so local values override shared `.env`.
  for (const name of [".env", ".env.local"]) {
    const p = join(ROOT, name);
    if (!existsSync(p)) continue;
    const { text } = readEnvFileRaw(p);
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 1) continue;
      let key = t.slice(0, eq).trim().replace(/^\uFEFF+/, "");
      if (key.toLowerCase().startsWith("export ")) key = key.slice(7).trim();
      let val = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!key) continue;
      // File is source of truth (overrides empty/stale process.env from the shell).
      process.env[key] = val;
    }
  }
}

/** Service role must be one long line; common typo is dropping `_ROLE_`. */
function resolveServiceRoleKey() {
  const names = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_KEY",
    "SERVICE_ROLE_KEY",
    "SUPABASE_SECRET"
  ];
  for (const n of names) {
    const raw = process.env[n];
    const t = typeof raw === "string" ? raw.trim() : "";
    if (t.length > 15) return t;
  }
  return "";
}

function logServiceKeyDiagnostics() {
  const names = ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SERVICE_ROLE_KEY", "SUPABASE_SECRET"];
  console.error("Service key lengths in env (names only, no values printed):");
  for (const n of names) {
    const raw = process.env[n];
    const len = typeof raw === "string" ? raw.trim().length : 0;
    console.error(`  ${n}: ${len}`);
  }
}

/** Supabase client wants `https://<ref>.supabase.co`, not the REST URL (`.../rest/v1`). */
function normalizeSupabaseUrl(raw) {
  if (!raw || typeof raw !== "string") return "";
  let u = raw.trim().replace(/\/+$/, "");
  u = u.replace(/\/rest\/v1\/?$/i, "");
  return u.replace(/\/+$/, "");
}

/** @param {unknown} v */
function firstString(v) {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  return null;
}

/** @param {unknown} attrs */
function attrTerm(attrs, ...names) {
  if (!Array.isArray(attrs)) return null;
  const want = names.map((n) => n.toLowerCase());
  for (const a of attrs) {
    if (!a || typeof a !== "object") continue;
    const n = firstString(/** @type {Record<string, unknown>} */ (a).name);
    if (!n || !want.includes(n.toLowerCase())) continue;
    const terms = /** @type {Record<string, unknown>} */ (a).terms;
    if (!Array.isArray(terms) || terms.length < 1) continue;
    const t0 = terms[0];
    if (!t0 || typeof t0 !== "object") continue;
    return firstString(/** @type {Record<string, unknown>} */ (t0).name);
  }
  return null;
}

/** @param {unknown} cats */
function mapCategory(cats) {
  if (!Array.isArray(cats)) return "Motorcycle";
  const list = cats
    .filter((c) => c && typeof c === "object")
    .map((c) => {
      const o = /** @type {Record<string, unknown>} */ (c);
      return { slug: (firstString(o.slug) ?? "").toLowerCase(), name: (firstString(o.name) ?? "").toLowerCase() };
    });

  const matchSlug = (/** @type {string[]} */ ...slugs) => {
    for (const c of list) {
      if (slugs.includes(c.slug)) return true;
    }
    return false;
  };

  if (matchSlug("side-by-side", "side_by_side", "side-by-sides")) return "Side by side";
  if (matchSlug("atv", "atvs")) return "ATV";
  if (matchSlug("snowmobile", "snowmobiles")) return "Snowmobile";
  if (matchSlug("motorcycle", "motorcycles")) return "Motorcycle";
  if (matchSlug("marine", "watercraft", "jetski", "jetskis", "pontoon", "pontoons", "boat", "boats")) return "Watercraft";

  for (const c of list) {
    const s = c.slug;
    const n = c.name;
    if (s.includes("side") && s.includes("side")) return "Side by side";
    if (n.includes("side by side") || n.includes("side-by-side")) return "Side by side";
    if (s.includes("atv") || n === "atv") return "ATV";
    if (s.includes("snowmobile") || n.includes("snowmobile")) return "Snowmobile";
    if (s.includes("motorcycle") || n.includes("motorcycle")) return "Motorcycle";
    if (s.includes("marine") || s.includes("water") || n.includes("marine") || n.includes("jetski")) return "Watercraft";
  }
  return "Motorcycle";
}

/** Same URL twice in Woo gallery → keep first occurrence only. */
function dedupePhotoUrls(urls) {
  const seen = new Set();
  const out = [];
  for (const u of urls) {
    if (typeof u !== "string" || !u.trim()) continue;
    const n = u.trim();
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/** @param {unknown} p */
function mapProduct(p) {
  if (!p || typeof p !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (p);
  const id = o.id;
  const pid = typeof id === "number" && Number.isFinite(id) ? String(id) : typeof id === "string" ? id : null;
  if (!pid) return null;

  const name = firstString(o.name);
  const permalink = firstString(o.permalink);
  const attrs = o.attributes;
  const make = attrTerm(attrs, "Make");
  const model = attrTerm(attrs, "Model");
  const yearStr = attrTerm(attrs, "Year");
  const year = yearStr ? Number.parseInt(yearStr.replace(/\D/g, ""), 10) : NaN;
  const kmStr = attrTerm(attrs, "Kilometers", "Kilometer", "Odometer", "Mileage");
  let odometer_km = null;
  if (kmStr) {
    const digits = kmStr.replace(/[^\d]/g, "");
    const k = Number.parseInt(digits, 10);
    if (Number.isFinite(k) && k >= 0) odometer_km = k;
  }

  const images = o.images;
  const urls = [];
  if (Array.isArray(images)) {
    for (const im of images) {
      if (!im || typeof im !== "object") continue;
      const src = firstString(/** @type {Record<string, unknown>} */ (im).src);
      if (src) urls.push(src);
    }
  }
  let photoUrls = dedupePhotoUrls(urls);
  // First image is usually MSF studio / marketing tile — match one-time DB trim + user request.
  if (photoUrls.length > 0) photoUrls = photoUrls.slice(1);

  return {
    import_source: IMPORT_SOURCE,
    source_product_id: pid,
    stock_number: `MSF-${pid}`,
    year: Number.isFinite(year) && year >= 1900 && year <= 2100 ? year : null,
    make,
    model,
    odometer_km,
    category: mapCategory(o.categories),
    source_photo_urls: photoUrls,
    source_permalink: permalink,
    source_product_name: name
  };
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const total = res.headers.get("X-WP-Total");
  const totalPages = res.headers.get("X-WP-TotalPages");
  const data = await res.json();
  return { data, total: total ? Number.parseInt(total, 10) : null, totalPages: totalPages ? Number.parseInt(totalPages, 10) : null };
}

/** Stock numbers already used on `inventory_units` with default MSF import pattern — skip re-queuing those Woo ids. */
async function loadCatalogMsfStockNumbers(supabase) {
  const set = new Set();
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

/** Remove first `source_photo_urls` entry for all MSF rows still `pending` (same effect as sql/marketing/11_*.sql). */
async function trimFirstPendingPhotos() {
  loadEnvFiles();
  const urlRaw = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const url = normalizeSupabaseUrl(typeof urlRaw === "string" ? urlRaw.trim() : "");
  const key = resolveServiceRoleKey();
  if (!url || !key) {
    console.error("Missing Supabase URL or service role key (same requirements as npm run msf:queue).");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  let updated = 0;
  let from = 0;
  const page = 500;
  for (;;) {
    const { data, error } = await supabase
      .from("inventory_import_queue")
      .select("id, source_photo_urls")
      .eq("import_source", IMPORT_SOURCE)
      .eq("status", "pending")
      .order("id", { ascending: true })
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    if (rows.length === 0) break;

    const updates = [];
    for (const row of rows) {
      const urls = row.source_photo_urls;
      if (!Array.isArray(urls) || urls.length === 0) continue;
      const next = urls.slice(1);
      if (row.id != null) {
        updates.push({ id: String(row.id), source_photo_urls: next });
      }
    }

    const chunk = 40;
    for (let i = 0; i < updates.length; i += chunk) {
      const part = updates.slice(i, i + chunk);
      const results = await Promise.all(
        part.map((u) =>
          supabase.from("inventory_import_queue").update({ source_photo_urls: u.source_photo_urls }).eq("id", u.id)
        )
      );
      for (const r of results) {
        if (r.error) throw new Error(r.error.message);
      }
    }
    updated += updates.length;
    process.stdout.write(`Trimmed first photo on ${updated} rows so far…\r`);

    if (rows.length < page) break;
    from += page;
  }
  process.stdout.write(`\nDone. Updated ${updated} pending row(s).\n`);
}

async function main() {
  loadEnvFiles();
  const urlRaw = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const url = normalizeSupabaseUrl(typeof urlRaw === "string" ? urlRaw.trim() : "");
  const key = resolveServiceRoleKey();
  if (!url || !key) {
    const localPath = join(ROOT, ".env.local");
    const envPath = join(ROOT, ".env");
    const hasLocal = existsSync(localPath);
    const hasEnv = existsSync(envPath);
    console.error("Missing SUPABASE_URL (or VITE_SUPABASE_URL) and/or a usable service-role secret after loading env files.");
    console.error(`Looked in: ${envPath} then ${localPath} (next to package.json).`);
    console.error(
      `Found files: .env=${hasEnv ? "yes" : "no"}, .env.local=${hasLocal ? "yes" : "no"}.`
    );
    const urlLen = typeof urlRaw === "string" ? urlRaw.trim().length : 0;
    const rawRoleLen =
      typeof process.env.SUPABASE_SERVICE_ROLE_KEY === "string" ? process.env.SUPABASE_SERVICE_ROLE_KEY.trim().length : 0;
    console.error(
      `After load: URL length=${urlLen}, SUPABASE_SERVICE_ROLE_KEY length=${rawRoleLen}, resolved service key length=${key.length}.`
    );
    if (urlLen > 0 && !key) {
      logServiceKeyDiagnostics();
      console.error(
        "Your URL loaded, but the service role did not. In .env.local add exactly one line (entire key on the same line, no line break in the middle):"
      );
      console.error("  SUPABASE_SERVICE_ROLE_KEY=paste_secret_here");
      console.error("Use the key labeled **service_role** (secret) in Supabase → Project Settings → API — not the anon/publishable key.");
    }
    if (typeof urlRaw === "string" && /rest\/v1/i.test(urlRaw)) {
      console.error("Your URL still contains /rest/v1 — use https://<ref>.supabase.co only (no /rest/v1).");
    }
    if (hasLocal || hasEnv) {
      console.error(
        "Also check: no space before/after '='; key name is SUPABASE_SERVICE_ROLE_KEY (not SUPABASE_SERVICE_KEY alone unless you use the alias we support)."
      );
    }
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  console.log("Loading existing queue statuses (to preserve posted rows)…");
  const statusByPid = new Map();
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

  console.log("Loading catalog stock_numbers MSF-* (skip queue upsert if already listed)…");
  const catalogMsfStocks = await loadCatalogMsfStockNumbers(supabase);

  const firstUrl = `${STORE_BASE}?per_page=${PER_PAGE}&page=1`;
  const { data: firstPage, total, totalPages } = await fetchJson(firstUrl);
  if (!Array.isArray(firstPage)) throw new Error("Unexpected Store API response (not an array).");

  const reportedPages =
    totalPages && Number.isFinite(totalPages) && totalPages > 0
      ? totalPages
      : total && Number.isFinite(total) && total > 0
        ? Math.ceil(total / PER_PAGE)
        : 1;

  console.log(`WooCommerce Store API: total=${total ?? "?"} pages≈${reportedPages}`);

  /** @type {Record<string, unknown>[]} */
  const allProducts = [...firstPage];

  for (let page = 2; page <= reportedPages; page++) {
    const u = `${STORE_BASE}?per_page=${PER_PAGE}&page=${page}`;
    process.stdout.write(`Fetching page ${page}/${reportedPages}…\r`);
    const { data } = await fetchJson(u);
    if (Array.isArray(data) && data.length) allProducts.push(...data);
    await new Promise((r) => setTimeout(r, 150));
  }
  process.stdout.write("\n");

  /** @type {Record<string, unknown>[]} */
  const toUpsert = [];
  let skippedPosted = 0;
  let skippedInCatalog = 0;
  for (const p of allProducts) {
    const mapped = mapProduct(p);
    if (!mapped) continue;
    const st = statusByPid.get(mapped.source_product_id);
    if (st === "posted") {
      skippedPosted += 1;
      continue;
    }
    if (catalogMsfStocks.has(mapped.stock_number)) {
      skippedInCatalog += 1;
      continue;
    }
    toUpsert.push({
      ...mapped,
      status: st === "skipped" ? "skipped" : "pending"
    });
  }

  console.log(
    `Mapped ${allProducts.length} products; upserting ${toUpsert.length} rows (${skippedPosted} queue-posted skipped, ${skippedInCatalog} already in catalog as MSF-*).`
  );

  const chunk = 80;
  for (let i = 0; i < toUpsert.length; i += chunk) {
    const part = toUpsert.slice(i, i + chunk);
    const { error } = await supabase.from("inventory_import_queue").upsert(part, {
      onConflict: "import_source,source_product_id"
    });
    if (error) throw new Error(error.message);
    process.stdout.write(`Upserted ${Math.min(i + chunk, toUpsert.length)}/${toUpsert.length}\r`);
  }
  process.stdout.write("\n");

  if (catalogMsfStocks.size > 0) {
    console.log("Removing stale pending queue rows whose MSF-* stock # already exists in catalog…");
    const stocks = [...catalogMsfStocks];
    const ch = 100;
    let removed = 0;
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
      removed += delRows?.length ?? 0;
    }
    if (removed > 0) console.log(`Removed ${removed} stale pending row(s) already on catalog.`);
  }

  console.log("Done.\n");
}

const argv = process.argv.slice(2);
const run = argv.includes("--trim-first-pending") ? trimFirstPendingPhotos : main;
run().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
