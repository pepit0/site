/**
 * Fetches non-Auto listings from overlandram.ca (WordPress Listivo REST API)
 * and upserts rows into Supabase `inventory_import_queue`.
 *
 * Includes Motorsport, Marine, RV, and Utility Trailer (~136 units; Auto excluded).
 *
 * Env (project root — loaded in order `.env` then `.env.local`, local overrides):
 *   SUPABASE_URL or VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (or aliases: SUPABASE_SERVICE_KEY, SERVICE_ROLE_KEY, SUPABASE_SECRET)
 *
 * Usage: npm run overlandram:queue
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  IMPORT_SOURCE,
  LISTIVO_API_BASE,
  PER_PAGE,
  mapListivoListing
} from "./lib/overlandram-listivo-map.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function readEnvFileRaw(p) {
  const buf = readFileSync(p);
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return { text: buf.subarray(2).toString("utf16le"), encoding: "utf-16le" };
  }
  let text = buf.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return { text, encoding: "utf-8" };
}

function loadEnvFiles() {
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
      process.env[key] = val;
    }
  }
}

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

function normalizeSupabaseUrl(raw) {
  if (!raw || typeof raw !== "string") return "";
  let u = raw.trim().replace(/\/+$/, "");
  u = u.replace(/\/rest\/v1\/?$/i, "");
  return u.replace(/\/+$/, "");
}

async function fetchListingsPage(page) {
  const url = `${LISTIVO_API_BASE}?per_page=${PER_PAGE}&page=${page}&status=publish`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const total = res.headers.get("X-WP-Total");
  const totalPages = res.headers.get("X-WP-TotalPages");
  const data = await res.json();
  return {
    data,
    total: total ? Number.parseInt(total, 10) : null,
    totalPages: totalPages ? Number.parseInt(totalPages, 10) : null
  };
}

/** @param {import("@supabase/supabase-js").SupabaseClient} supabase */
async function loadCatalogStockNumbers(supabase, stocks) {
  const set = new Set();
  if (stocks.size === 0) return set;
  const list = [...stocks];
  const chunk = 80;
  for (let i = 0; i < list.length; i += chunk) {
    const part = list.slice(i, i + chunk);
    const { data, error } = await supabase.from("inventory_units").select("stock_number").in("stock_number", part);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      if (r && typeof r.stock_number === "string") set.add(r.stock_number.trim());
    }
  }
  return set;
}

async function main() {
  loadEnvFiles();
  const urlRaw = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const url = normalizeSupabaseUrl(typeof urlRaw === "string" ? urlRaw.trim() : "");
  const key = resolveServiceRoleKey();
  if (!url || !key) {
    console.error("Missing SUPABASE_URL (or VITE_SUPABASE_URL) and/or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  console.log("Loading existing queue statuses (preserve posted rows)…");
  const statusByPid = new Map();
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
  if (!Array.isArray(firstPage)) throw new Error("Unexpected Listivo API response.");

  const pages =
    totalPages && Number.isFinite(totalPages) && totalPages > 0
      ? totalPages
      : total && Number.isFinite(total) && total > 0
        ? Math.ceil(total / PER_PAGE)
        : 1;

  /** @type {unknown[]} */
  const allListings = [...firstPage];
  for (let page = 2; page <= pages; page++) {
    process.stdout.write(`Fetching page ${page}/${pages}…\r`);
    const { data } = await fetchListingsPage(page);
    if (Array.isArray(data) && data.length) allListings.push(...data);
    await new Promise((r) => setTimeout(r, 120));
  }
  process.stdout.write("\n");

  let skippedAuto = 0;
  let skippedUnmapped = 0;
  /** @type {ReturnType<typeof mapListivoListing>[]} */
  const mapped = [];
  for (const row of allListings) {
    const m = mapListivoListing(row);
    if (!m) {
      const o = row && typeof row === "object" ? /** @type {Record<string, unknown>} */ (row) : null;
      const typeArr = o?.listivo_14;
      const type =
        Array.isArray(typeArr) && typeof typeArr[0] === "string" ? typeArr[0].toLowerCase() : "";
      if (type === "auto") skippedAuto += 1;
      else skippedUnmapped += 1;
      continue;
    }
    mapped.push(m);
  }

  console.log(
    `Listivo API: ${allListings.length} published listing(s); ${mapped.length} non-Auto mapped; ${skippedAuto} Auto skipped.`
  );

  const stocksToCheck = new Set(mapped.map((m) => m.stock_number));
  console.log("Checking catalog for matching stock numbers…");
  const catalogStocks = await loadCatalogStockNumbers(supabase, stocksToCheck);

  /** @type {Record<string, unknown>[]} */
  const toUpsert = [];
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

  console.log(
    `${importedNew} new · ${alreadyPending} pending (unchanged) · ${alreadySkipped} skipped (unchanged) · ${ignoredPosted} posted (ignored) · ${ignoredInCatalog} in catalog (ignored).`
  );
  console.log(`Upserting ${toUpsert.length} row(s)…`);

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

  if (catalogStocks.size > 0) {
    console.log("Removing stale pending queue rows whose stock # already exists in catalog…");
    const stocks = [...catalogStocks];
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
    if (removed > 0) console.log(`Removed ${removed} stale pending row(s).`);
  }

  console.log("Done.\n");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
