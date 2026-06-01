/**
 * Bulk sync used US dealer inventory into inventory_import_queue.
 * Dedupes on import_source + source_product_id (re-runs only add newly listed units).
 *
 * Usage:
 *   npm run us:bulk-queue
 *   npm run us:bulk-queue -- magnummotorsports extremepowersports
 *   npm run us:bulk-queue -- --all
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { importSourceKey, loadUsImportSources, scanSourceCatalog } from "./lib/us-bulk-sync.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function loadEnvFiles() {
  for (const name of [".env", ".env.local"]) {
    const p = join(ROOT, name);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

function resolveServiceRoleKey() {
  for (const n of ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SERVICE_ROLE_KEY"]) {
    const t = process.env[n]?.trim();
    if (t && t.length > 15) return t;
  }
  return "";
}

function normalizeSupabaseUrl(raw) {
  if (!raw) return "";
  return raw.trim().replace(/\/+$/, "").replace(/\/rest\/v1\/?$/i, "");
}

function parseTmsSeq(stock) {
  const m = stock.trim().toUpperCase().match(/^TMS(\d+)$/);
  return m ? Number.parseInt(m[1], 10) : null;
}

function createTmsAllocator(reserved) {
  let seq = 1;
  for (const s of reserved) {
    const n = parseTmsSeq(s);
    if (n != null && n >= seq) seq = n + 1;
  }
  return {
    next() {
      for (;;) {
        const candidate = `TMS${String(seq).padStart(4, "0")}`;
        seq += 1;
        const n = candidate.toUpperCase();
        if (!reserved.has(n)) {
          reserved.add(n);
          return n;
        }
      }
    }
  };
}

async function loadReservedStocks(supabase) {
  const reserved = new Set();
  for (const table of ["inventory_import_queue", "inventory_units"]) {
    let from = 0;
    for (;;) {
      const { data, error } = await supabase.from(table).select("stock_number").range(from, from + 499);
      if (error) throw error;
      for (const r of data ?? []) {
        if (r?.stock_number?.trim()) reserved.add(r.stock_number.trim().toUpperCase());
      }
      if ((data?.length ?? 0) < 500) break;
      from += 500;
    }
  }
  return reserved;
}

async function loadQueueKeys(supabase) {
  const keys = new Set();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("inventory_import_queue")
      .select("import_source, source_product_id")
      .range(from, from + 499);
    if (error) throw error;
    for (const r of data ?? []) {
      keys.add(`${r.import_source}:${r.source_product_id}`);
    }
    if ((data?.length ?? 0) < 500) break;
    from += 500;
  }
  return keys;
}

function appendDealerStockNote(notes, dealerStock) {
  const stock = dealerStock?.trim();
  if (!stock) return notes?.trim() || null;
  const line = `Dealer stock #: ${stock}`;
  const prev = notes?.trim() ?? "";
  return prev ? `${prev}\n${line}` : line;
}

function prependLabel(notes, label) {
  const line = `US source: ${label}`;
  const prev = notes?.trim() ?? "";
  if (!prev) return line;
  if (prev.startsWith("US source:")) return prev;
  return `${line}\n${prev}`;
}

async function main() {
  loadEnvFiles();
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const key = resolveServiceRoleKey();
  if (!url || !key) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const args = process.argv.slice(2).filter((a) => a !== "--");
  const allSources = args.includes("--all");
  const sourceFilter = new Set(args.filter((a) => !a.startsWith("--")));

  const minPhotos = args.includes("--min-photos-5") ? 5 : 4;

  let sources = loadUsImportSources().filter((s) => s.adapter === "dealer_spike" || s.adapter === "dx1");
  if (!allSources && sourceFilter.size > 0) {
    sources = sources.filter((s) => sourceFilter.has(s.id));
  } else if (!allSources) {
    sources = sources.filter((s) => ["magnummotorsports", "extremepowersports"].includes(s.id));
  }

  console.log(`Bulk US import → ${sources.map((s) => s.label ?? s.id).join(", ")}\n`);

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const queueKeys = await loadQueueKeys(supabase);
  const reserved = await loadReservedStocks(supabase);
  const tms = createTmsAllocator(reserved);
  const seen = new Set();

  let scanned = 0;
  let queued = 0;
  let already = 0;
  let skipped = 0;
  const bySource = {};
  const byCategory = {};

  for (const source of sources) {
    const importSource = importSourceKey(source);
    console.log(`Scanning ${source.label ?? source.id}…`);
    let sourceQueued = 0;

    for await (const c of scanSourceCatalog(source, importSource, seen)) {
      scanned += 1;
      const qKey = `${c.importSource}:${c.sourceProductId}`;
      if (queueKeys.has(qKey)) {
        already += 1;
        continue;
      }
      if (!c.make || !c.model || !c.year || c.photoUrls.length < minPhotos) {
        skipped += 1;
        continue;
      }

      const stock = tms.next();
      const row = {
        import_source: c.importSource,
        source_product_id: c.sourceProductId,
        stock_number: stock,
        year: c.year,
        make: c.make,
        model: c.model,
        odometer_km: c.odometerKm,
        category: c.category,
        source_photo_urls: c.photoUrls,
        source_permalink: c.permalink,
        source_product_name: c.title,
        source_notes: appendDealerStockNote(prependLabel(c.sourceNotes, source.label), c.stockNumber),
        status: "pending"
      };

      let { error } = await supabase.from("inventory_import_queue").upsert(row, {
        onConflict: "import_source,source_product_id",
        ignoreDuplicates: true
      });
      if (error && /source_notes/i.test(error.message)) {
        const { source_notes: _n, ...base } = row;
        ({ error } = await supabase.from("inventory_import_queue").upsert(base, {
          onConflict: "import_source,source_product_id",
          ignoreDuplicates: true
        }));
      }
      if (error) {
        if (/duplicate|unique/i.test(error.message)) {
          already += 1;
          queueKeys.add(qKey);
          continue;
        }
        throw error;
      }

      queueKeys.add(qKey);
      queued += 1;
      sourceQueued += 1;
      bySource[source.id] = (bySource[source.id] ?? 0) + 1;
      byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
    }

    console.log(`  → ${sourceQueued} new row(s) queued\n`);
  }

  console.log("Done.");
  console.log(`Scanned: ${scanned}`);
  console.log(`Queued (new): ${queued}`);
  console.log(`Already in queue: ${already}`);
  console.log(`Skipped (quality): ${skipped}`);
  console.log("By source:", bySource);
  console.log("By category:", byCategory);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
