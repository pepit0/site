/**
 * Hard-delete all MSF-linked catalog units, their storage photos, and the MSF import queue.
 *
 * Env (project root — loaded in order `.env` then `.env.local`, local overrides):
 *   SUPABASE_URL or VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (or aliases: SUPABASE_SERVICE_KEY, SERVICE_ROLE_KEY, SUPABASE_SECRET)
 *
 * Usage:
 *   npm run msf:remove              — dry run (preview only)
 *   npm run msf:remove:execute      — delete after confirmation prompt
 *   node scripts/remove-msf-inventory.mjs --execute --yes  — skip confirmation
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stdin as input, stdout as output } from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const IMPORT_SOURCE = "motorsportsfinancing_wc";
const PHOTOS_BUCKET = "inventory-photos";
const MSF_STOCK_PREFIX = "MSF-";

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

function unitTitle(row) {
  const y = row.year != null ? String(row.year) : "?";
  const mk = row.make?.trim() || "";
  const md = row.model?.trim() || "";
  const core = `${mk} ${md}`.trim();
  return core ? `${y} ${core}` : row.stock_number;
}

/** @param {import("@supabase/supabase-js").SupabaseClient} supabase */
async function fetchAllByStockPrefix(supabase) {
  /** @type {{ id: string; stock_number: string; year: number | null; make: string | null; model: string | null; status: string; photo_paths: string[] }[]} */
  const out = [];
  const page = 500;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from("inventory_units")
      .select("id, stock_number, year, make, model, status, photo_paths")
      .like("stock_number", `${MSF_STOCK_PREFIX}%`)
      .order("stock_number", { ascending: true })
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

/** @param {import("@supabase/supabase-js").SupabaseClient} supabase */
async function fetchLinkedInventoryIds(supabase) {
  const ids = new Set();
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from("inventory_import_queue")
      .select("imported_inventory_id")
      .eq("import_source", IMPORT_SOURCE)
      .not("imported_inventory_id", "is", null)
      .order("id", { ascending: true })
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    for (const r of rows) {
      if (r && typeof r.imported_inventory_id === "string") ids.add(r.imported_inventory_id);
    }
    if (rows.length < page) break;
  }
  return ids;
}

/** @param {import("@supabase/supabase-js").SupabaseClient} supabase @param {Set<string>} ids */
async function fetchUnitsByIds(supabase, ids) {
  if (ids.size === 0) return [];
  /** @type {{ id: string; stock_number: string; year: number | null; make: string | null; model: string | null; status: string; photo_paths: string[] }[]} */
  const out = [];
  const list = [...ids];
  const chunk = 80;
  for (let i = 0; i < list.length; i += chunk) {
    const part = list.slice(i, i + chunk);
    const { data, error } = await supabase
      .from("inventory_units")
      .select("id, stock_number, year, make, model, status, photo_paths")
      .in("id", part);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
  }
  return out;
}

/** @param {import("@supabase/supabase-js").SupabaseClient} supabase */
async function countQueueRows(supabase) {
  const { count, error } = await supabase
    .from("inventory_import_queue")
    .select("id", { count: "exact", head: true })
    .eq("import_source", IMPORT_SOURCE);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** @param {import("@supabase/supabase-js").SupabaseClient} supabase @param {string[]} paths */
async function removePhotos(supabase, paths) {
  if (paths.length === 0) return 0;
  let removed = 0;
  const chunk = 100;
  for (let i = 0; i < paths.length; i += chunk) {
    const part = paths.slice(i, i + chunk);
    const { error } = await supabase.storage.from(PHOTOS_BUCKET).remove(part);
    if (error && !/not found|object not found/i.test(error.message)) {
      throw new Error(`Storage remove failed: ${error.message}`);
    }
    removed += part.length;
  }
  return removed;
}

/** @param {import("@supabase/supabase-js").SupabaseClient} supabase @param {string[]} unitIds */
async function deleteUnits(supabase, unitIds) {
  if (unitIds.length === 0) return 0;
  let deleted = 0;
  const chunk = 50;
  for (let i = 0; i < unitIds.length; i += chunk) {
    const part = unitIds.slice(i, i + chunk);
    const { data, error } = await supabase.from("inventory_units").delete().in("id", part).select("id");
    if (error) throw new Error(error.message);
    deleted += data?.length ?? 0;
  }
  return deleted;
}

/** @param {import("@supabase/supabase-js").SupabaseClient} supabase */
async function purgeQueue(supabase) {
  let removed = 0;
  const page = 500;
  for (;;) {
    const { data, error } = await supabase
      .from("inventory_import_queue")
      .delete()
      .eq("import_source", IMPORT_SOURCE)
      .select("id")
      .limit(page);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    removed += rows.length;
    if (rows.length < page) break;
  }
  return removed;
}

async function confirmExecute(unitCount, queueCount, photoCount) {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(
      `\nDelete ${unitCount} catalog unit(s), ${photoCount} photo(s), and ${queueCount} import queue row(s)? Type "yes" to continue: `
    );
    return answer.trim().toLowerCase() === "yes";
  } finally {
    rl.close();
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const execute = argv.includes("--execute");
  const skipConfirm = argv.includes("--yes");

  loadEnvFiles();
  const urlRaw = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const url = normalizeSupabaseUrl(typeof urlRaw === "string" ? urlRaw.trim() : "");
  const key = resolveServiceRoleKey();
  if (!url || !key) {
    console.error("Missing SUPABASE_URL (or VITE_SUPABASE_URL) and/or SUPABASE_SERVICE_ROLE_KEY after loading env files.");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  console.log("Scanning for MSF catalog units…");
  const byStock = await fetchAllByStockPrefix(supabase);
  const linkedIds = await fetchLinkedInventoryIds(supabase);
  const byQueue = await fetchUnitsByIds(supabase, linkedIds);

  /** @type {Map<string, typeof byStock[0]>} */
  const unitsById = new Map();
  for (const row of [...byStock, ...byQueue]) {
    if (row && typeof row.id === "string") unitsById.set(row.id, row);
  }
  const units = [...unitsById.values()].sort((a, b) => a.stock_number.localeCompare(b.stock_number));

  const queueCount = await countQueueRows(supabase);
  const photoPaths = units.flatMap((u) => (Array.isArray(u.photo_paths) ? u.photo_paths.filter((p) => typeof p === "string") : []));

  const fromStockOnly = byStock.length;
  const fromQueueOnly = units.filter((u) => !byStock.some((s) => s.id === u.id)).length;

  console.log("\n--- MSF removal preview ---");
  console.log(`Catalog units to delete: ${units.length}`);
  console.log(`  · ${fromStockOnly} with stock_number ${MSF_STOCK_PREFIX}*`);
  if (fromQueueOnly > 0) {
    console.log(`  · ${fromQueueOnly} additional via import queue linkage (stock # may differ)`);
  }
  console.log(`Storage photos to remove: ${photoPaths.length}`);
  console.log(`Import queue rows to delete: ${queueCount} (${IMPORT_SOURCE})`);

  if (units.length > 0) {
    console.log("\nSample units (up to 10):");
    for (const row of units.slice(0, 10)) {
      console.log(`  · #${row.stock_number} — ${unitTitle(row)} (${row.status})`);
    }
    if (units.length > 10) console.log(`  … and ${units.length - 10} more`);
  }

  if (!execute) {
    console.log("\nDry run only — no changes made.");
    console.log("Run with --execute to delete: npm run msf:remove:execute");
    return;
  }

  if (!skipConfirm) {
    const ok = await confirmExecute(units.length, queueCount, photoPaths.length);
    if (!ok) {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  console.log("\nRemoving photos from storage…");
  const photosRemoved = await removePhotos(supabase, photoPaths);
  console.log(`Removed ${photosRemoved} photo object(s).`);

  console.log("Deleting catalog units…");
  const unitIds = units.map((u) => u.id);
  const unitsDeleted = await deleteUnits(supabase, unitIds);
  console.log(`Deleted ${unitsDeleted} catalog unit(s).`);

  console.log("Purging MSF import queue…");
  const queueRemoved = await purgeQueue(supabase);
  console.log(`Deleted ${queueRemoved} import queue row(s).`);

  console.log("\nDone. Redeploy or run `npm run build` to refresh sitemap and prerendered inventory pages.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
