/**
 * Remove ® / ™ from imported make/model/title fields already in queue or catalog.
 *
 * Usage: node scripts/fix-import-trademark-labels.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function loadEnvFiles() {
  for (const name of [".env", ".env.local"]) {
    const p = join(ROOT, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
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

function sanitizeImportLabel(value) {
  if (value == null) return "";
  return String(value)
    .replace(/\u00AE/g, "")
    .replace(/\u2122/g, "")
    .replace(/&reg;/gi, "")
    .replace(/&trade;/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function needsSanitize(value) {
  if (value == null) return false;
  const s = String(value);
  return /\u00AE|\u2122|&reg;|&trade;/i.test(s);
}

async function patchTable(supabase, table, fields, selectExtra = "") {
  let updated = 0;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(`id, ${fields.join(", ")}${selectExtra ? `, ${selectExtra}` : ""}`)
      .range(from, from + 499);
    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) {
      const patch = {};
      for (const field of fields) {
        const raw = row[field];
        if (!needsSanitize(raw)) continue;
        const clean = sanitizeImportLabel(raw);
        if (clean && clean !== raw) patch[field] = clean;
      }
      if (Object.keys(patch).length === 0) continue;
      const { error: upErr } = await supabase.from(table).update(patch).eq("id", row.id);
      if (upErr) throw upErr;
      updated += 1;
    }
    if (rows.length < 500) break;
    from += 500;
  }
  return updated;
}

async function main() {
  loadEnvFiles();
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim() ||
    process.env.SERVICE_ROLE_KEY?.trim() ||
    "";
  if (!url || !key) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const queueUpdated = await patchTable(supabase, "inventory_import_queue", [
    "make",
    "model",
    "source_product_name"
  ]);
  const catalogUpdated = await patchTable(supabase, "inventory_units", ["make", "model"]);
  console.log(`Updated ${queueUpdated} import queue row(s), ${catalogUpdated} catalog unit(s).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
