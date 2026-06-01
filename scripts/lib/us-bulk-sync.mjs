/**
 * Node bulk catalog sync for US import sources (Dealer Spike + DX1).
 * Keep in sync with supabase/functions/_shared/us-import/bulk-catalog-sync.ts
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

const OID_RE = /oid(?:=|%3D|%26#x3D;|&#x3D;)(\d+)/gi;
const USED_LIST_CONDITIONS = ["Pre-Owned", "Used", "USED", "pre-owned"];
const LIST_PAGE_SIZE = 50;
const DETAIL_CONCURRENCY = 12;
const UA = "TemptationMotorsportsImport/1.0";

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

function applyListExtraParams(params, extra) {
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (!key || value == null) continue;
    if (Array.isArray(value)) {
      for (const v of value) {
        if (v) params.append(key, v);
      }
    } else if (value) {
      params.set(key, value);
    }
  }
}

export function loadUsImportSources() {
  const path = join(ROOT, "config", "us-import-sources.json");
  return JSON.parse(readFileSync(path, "utf8"));
}

export function importSourceKey(source) {
  return `us_${source.adapter}_${source.id}`;
}

function mapDealerSpikeCategory(vtype, subcategory) {
  const t = (vtype ?? "").toLowerCase();
  const s = (subcategory ?? "").toLowerCase();
  if (t.includes("snowmobile") || s.includes("snowmobile")) return "Snowmobile";
  if (t.includes("boat") || t.includes("personal watercraft") || t.includes("watercraft") || t.includes("pwc") || s.includes("wakeboard")) {
    return "Watercraft";
  }
  if (t.includes("motorcycle") || t.includes("scooter") || s.includes("sport") || s.includes("dirt") || s.includes("dual")) {
    return "Motorcycle";
  }
  if (t.includes("atv")) return "ATV";
  if (t.includes("utility vehicle") || t.includes("side-by-side") || t.includes("side by side") || t === "sxs") {
    return "Side by side";
  }
  if (t.includes("trailer") || t.includes("rv")) return "Trailer";
  return null;
}

function mapDx1Category(productCategory, productType) {
  const c = (productCategory ?? "").toLowerCase();
  const t = (productType ?? "").toLowerCase();
  if (c.includes("snowmobile") || t.includes("summit") || t.includes("ski-doo")) return "Snowmobile";
  if (c.includes("watercraft") || c.includes("marine") || c.includes("boat")) return "Watercraft";
  if (c.includes("atv")) return "ATV";
  if (c.includes("utility") || t.includes("rzr") || t.includes("ranger") || t.includes("teryx") || t.includes("mule") || t.includes("wolverine")) {
    return "Side by side";
  }
  if (c.includes("motorcycle")) return "Motorcycle";
  if (c.includes("trailer")) return "Trailer";
  return null;
}

function isUsedCondition(raw) {
  const c = String(raw ?? "").trim().toUpperCase().replace(/-/g, " ");
  return c === "USED" || c === "CERTIFIED" || c === "PRE OWNED" || c === "PREOWNED";
}

function passesQuality(c, minPhotos) {
  if (!c.make?.trim() || !c.model?.trim()) return false;
  if (!Number.isFinite(c.year) || c.year < 1900 || c.year > 2100) return false;
  if (c.photoUrls.length < minPhotos) return false;
  return true;
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { Accept: "text/html,application/json,*/*", "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json,*/*", "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

function extractOids(html) {
  const seen = new Set();
  const out = [];
  for (const m of html.matchAll(OID_RE)) {
    if (!m[1] || seen.has(m[1])) continue;
    seen.add(m[1]);
    out.push(m[1]);
  }
  return out;
}

async function fetchDetailRow(base, oid) {
  try {
    const detail = await fetchJson(`${base}/--xInventoryDetail?oid=${oid}&format=json`);
    return Array.isArray(detail) ? detail[0] : null;
  } catch {
    return null;
  }
}

function applySkipFirstPhoto(urls, skipFirst) {
  if (!skipFirst || urls.length === 0) return urls;
  return urls.slice(1);
}

function photosFromDetail(d, skipFirstPhoto) {
  const urls = [];
  if (Array.isArray(d.aImages)) {
    for (const im of d.aImages) {
      const u = im.Extra || im.Large || im.URL || im.Medium;
      if (typeof u === "string" && u.trim()) urls.push(u.startsWith("//") ? `https:${u}` : u);
    }
  }
  return applySkipFirstPhoto([...new Set(urls)], skipFirstPhoto);
}

function mapDealerDetail(d, base, importSource, skipFirstPhoto) {
  const id = d.id != null ? String(d.id) : null;
  if (!id) return null;
  const category = mapDealerSpikeCategory(d.category, d.subcategory);
  if (!category) return null;
  const year = typeof d.year === "number" ? d.year : null;
  const make = sanitizeImportLabel(d.make) || null;
  const model = sanitizeImportLabel(d.model) || null;
  if (!year || !make || !model) return null;
  let miles = null;
  if (typeof d.miles_normalized === "number") miles = Math.round(d.miles_normalized);
  else if (d.miles) {
    const m = String(d.miles).match(/([\d,]+)/);
    if (m?.[1]) miles = Number.parseInt(m[1].replace(/,/g, ""), 10);
  }
  const photoUrls = photosFromDetail(d, skipFirstPhoto);
  const permalink = d.detailpage
    ? d.detailpage.startsWith("http")
      ? d.detailpage
      : `${base}${d.detailpage.startsWith("/") ? d.detailpage : `/${d.detailpage}`}`
    : `${base}/--xInventoryDetail?oid=${id}`;
  return {
    sourceProductId: id,
    stockNumber: (d.stock_number ?? "").trim() || `US-${id}`,
    year,
    make,
    model,
    odometerKm: miles != null ? Math.round(miles * 1.60934) : null,
    category,
    photoUrls,
    permalink,
    title: sanitizeImportLabel(d.title) || `${year} ${make} ${model}`,
    sourceNotes: [d.location ? `US source: ${d.location}` : null, permalink ? `Source: ${permalink}` : null]
      .filter(Boolean)
      .join("\n"),
    importSource
  };
}

export async function* scanDealerSpike(source, importSource, seen) {
  const base = source.baseUrl.replace(/\/+$/, "");
  const listPath = (source.listPath ?? "--Inventory").replace(/^\/+/, "");
  const conditions = source.listCondition ? [source.listCondition] : USED_LIST_CONDITIONS;
  for (const condition of conditions) {
    for (let page = 1; page <= 40; page++) {
      const params = new URLSearchParams({ pg: String(page), sz: String(LIST_PAGE_SIZE), condition });
      applyListExtraParams(params, source.listExtraParams);
      let html;
      try {
        html = await fetchText(`${base}/${listPath}?${params}`);
      } catch {
        break;
      }
      const oids = extractOids(html).filter((oid) => !seen.has(`${importSource}:${oid}`));
      if (!oids.length) break;
      for (let i = 0; i < oids.length; i += DETAIL_CONCURRENCY) {
        const batch = oids.slice(i, i + DETAIL_CONCURRENCY);
        const details = await Promise.all(batch.map((oid) => fetchDetailRow(base, oid)));
        for (let j = 0; j < batch.length; j++) {
          const row = details[j];
          const oid = batch[j];
          if (!row || !isUsedCondition(row.condition)) continue;
          const c = mapDealerDetail(row, base, importSource, source.skipFirstPhoto);
          if (!c) continue;
          seen.add(`${importSource}:${oid}`);
          yield c;
        }
      }
      if (oids.length < LIST_PAGE_SIZE) break;
    }
  }
}

async function loadDx1Creds(baseUrl, listPath) {
  const html = await fetchText(`${baseUrl.replace(/\/+$/, "")}${listPath}`);
  const appId =
    html.match(/applicationId['":\s]+['"]([^'"]+)/i)?.[1] ??
    html.match(/appId['":\s]+['"]([^'"]+)/i)?.[1];
  const apiKey = html.match(/apiKey['":\s]+['"]([^'"]+)/i)?.[1];
  if (!appId || !apiKey) throw new Error("DX1 Algolia credentials not found");
  return { appId, apiKey, indexName: "prod_WebSellable" };
}

function photosFromDx1Hit(hit) {
  const urls = [];
  if (Array.isArray(hit.PhotoLists)) {
    for (const p of [...hit.PhotoLists].sort((a, b) => (a.Seq ?? 0) - (b.Seq ?? 0))) {
      if (p.Url?.trim()) urls.push(p.Url.trim());
    }
  }
  if (!urls.length && hit.PhotoUrl?.trim()) urls.push(hit.PhotoUrl.trim());
  return [...new Set(urls)];
}

function mapDx1Hit(hit, importSource) {
  const id = hit.objectID;
  if (!id) return null;
  const category = mapDx1Category(hit.ProductCategory, hit.ProductType);
  if (!category) return null;
  const make = sanitizeImportLabel(hit.Manufacturer);
  const model = sanitizeImportLabel(hit.ProductName);
  const year = hit.Year;
  if (!make || !model || !year) return null;
  const miles = typeof hit.Odometer === "number" ? hit.Odometer : null;
  return {
    sourceProductId: id,
    stockNumber: (hit.StockNumber ?? "").trim() || `DX1-${id.slice(0, 8)}`,
    year,
    make,
    model,
    odometerKm: miles != null ? Math.round(miles * 1.60934) : null,
    category,
    photoUrls: photosFromDx1Hit(hit),
    permalink: hit.ShowroomUrl?.trim() || null,
    title: `${year} ${make} ${model}`,
    sourceNotes: [
      hit.DealershipName ? `US source: ${hit.DealershipName}` : null,
      hit.ShowroomUrl ? `Source: ${hit.ShowroomUrl}` : null
    ]
      .filter(Boolean)
      .join("\n"),
    importSource
  };
}

export async function* scanDx1(source, importSource, seen) {
  const listPath = source.dx1ListPath ?? "/Inventory/Used-Inventory";
  const filter = source.dx1Filter ?? "Condition:Used";
  const creds = await loadDx1Creds(source.baseUrl, listPath);
  for (let page = 0; ; page++) {
    const params = new URLSearchParams({ hitsPerPage: "50", page: String(page), filters: filter });
    const res = await fetch(`https://${creds.appId.toLowerCase()}-dsn.algolia.net/1/indexes/*/queries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Algolia-Application-Id": creds.appId,
        "X-Algolia-API-Key": creds.apiKey
      },
      body: JSON.stringify({ requests: [{ indexName: creds.indexName, params: params.toString() }] })
    });
    const data = await res.json();
    const result = data.results?.[0];
    const hits = result?.hits ?? [];
    if (!hits.length) break;
    for (const hit of hits) {
      if (!hit.objectID || seen.has(`${importSource}:${hit.objectID}`)) continue;
      const c = mapDx1Hit(hit, importSource);
      if (!c) continue;
      seen.add(`${importSource}:${hit.objectID}`);
      yield c;
    }
    if (page + 1 >= (result?.nbPages ?? 0)) break;
  }
}

export async function* scanSourceCatalog(source, importSource, seen) {
  if (source.adapter === "dealer_spike") yield* scanDealerSpike(source, importSource, seen);
  else if (source.adapter === "dx1") yield* scanDx1(source, importSource, seen);
}
