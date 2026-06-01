/**
 * Local smoke test for Dealer Spike (RideNow) adapter logic.
 * Usage: node scripts/test-dealer-spike-import.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Inline minimal copies of adapter helpers (edge function is Deno-only)
const OID_RE = /oid(?:=|%3D|%26#x3D;|&#x3D;)(\d+)/gi;

function isUsedInventoryCondition(raw) {
  const c = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/-/g, " ");
  return c === "USED" || c === "CERTIFIED" || c === "PRE OWNED" || c === "PREOWNED";
}

function dealerSpikeCategoryQuery(category) {
  switch (category) {
    case "ATV":
      return { vtype: "ATV" };
    case "Side by side":
      return { vtype: "Utility Vehicle" };
    case "Motorcycle":
      return { vtype: "Motorcycle" };
    case "Snowmobile":
      return { vtype: "Snowmobile" };
    case "Watercraft":
      return { vtype: "Personal Watercraft" };
    case "Trailer":
      return { vtype: "Trailer" };
    default:
      return {};
  }
}

function mapDealerSpikeCategory(vtype, subcategory) {
  const t = (vtype ?? "").toLowerCase();
  const s = (subcategory ?? "").toLowerCase();
  if (t.includes("snowmobile") || s.includes("snowmobile")) return "Snowmobile";
  if (t.includes("personal watercraft") || t.includes("watercraft") || t.includes("pwc")) return "Watercraft";
  if (t.includes("motorcycle") || t.includes("scooter")) return "Motorcycle";
  if (t.includes("atv")) return "ATV";
  if (t.includes("utility vehicle") || t.includes("side-by-side") || t.includes("side by side") || t === "sxs") {
    return "Side by side";
  }
  if (t.includes("trailer") || t.includes("rv") || t.includes("travel")) return "Trailer";
  return null;
}

function passesQualityFilter(c, minPhotos = 5) {
  if (!c.make?.trim() || !c.model?.trim()) return false;
  if (!Number.isFinite(c.year) || c.year < 1900 || c.year > 2100) return false;
  if (c.photoUrls.length < minPhotos) return false;
  return true;
}

async function searchCategory(base, category, usedOnly, maxCandidates) {
  const q = dealerSpikeCategoryQuery(category);
  const params = new URLSearchParams();
  params.set("pg", "1");
  params.set("sz", "50");
  if (usedOnly) params.set("condition", "Pre-Owned");
  if (q.vtype) params.set("vtype", q.vtype);

  let yielded = 0;
  const qualified = [];

  for (let page = 1; page <= 3 && yielded < maxCandidates; page++) {
    params.set("pg", String(page));
    const listUrl = `${base}/--Inventory?${params.toString()}`;
    const res = await fetch(listUrl, { headers: { "User-Agent": "Test/1.0" } });
    const html = await res.text();
    const oids = [...new Set([...html.matchAll(OID_RE)].map((m) => m[1]))];
    if (!oids.length) break;

    for (const oid of oids) {
      if (yielded >= maxCandidates) break;
      const dr = await fetch(`${base}/--xInventoryDetail?oid=${oid}&format=json`, {
        headers: { Accept: "application/json" }
      });
      const data = await dr.json();
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) continue;
      if (usedOnly && !isUsedInventoryCondition(row.condition)) continue;
      const cat = mapDealerSpikeCategory(row.category, row.subcategory);
      if (cat !== category) continue;
      const photos = Array.isArray(row.aImages) ? row.aImages.length : 0;
      const candidate = {
        oid,
        year: row.year,
        make: row.make,
        model: row.model,
        condition: row.condition,
        photos
      };
      if (passesQualityFilter({ ...candidate, photoUrls: Array.from({ length: photos }) })) {
        qualified.push(candidate);
        yielded++;
      }
    }
  }
  return qualified;
}

const base = "https://www.ridenow.com";
const categories = ["Motorcycle", "ATV", "Side by side"];
console.log("Testing Pre-Owned import path...\n");
for (const cat of categories) {
  const found = await searchCategory(base, cat, true, 3);
  console.log(`${cat}: ${found.length} qualifying (need 3)`);
  for (const f of found) {
    console.log(`  ${f.year} ${f.make} ${f.model} (${f.condition}, ${f.photos} photos)`);
  }
}
