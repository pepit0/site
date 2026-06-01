import type { SearchOpts, UsImportCandidate, VehicleCategory } from "./types.ts";
import { dedupeUrls, sanitizeImportLabel } from "./types.ts";

function firstTerm(v: unknown): string | null {
  if (!Array.isArray(v) || v.length < 1) return null;
  const t = v[0];
  return typeof t === "string" && t.trim() ? t.trim() : null;
}

function parseYear(raw: unknown): number | null {
  if (raw == null) return null;
  const y = Number.parseInt(String(raw).replace(/\D/g, ""), 10);
  return Number.isFinite(y) && y >= 1900 && y <= 2100 ? y : null;
}

function parseOdometerKm(raw: unknown): number | null {
  if (raw == null) return null;
  const s = typeof raw === "string" ? raw : String(raw);
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return null;
  const k = Number.parseInt(digits, 10);
  return Number.isFinite(k) && k >= 0 ? k : null;
}

function mapListivoCategory(type: string | null, subtype: string | null): VehicleCategory {
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

function mapListivoRow(row: unknown, importSource: string): UsImportCandidate | null {
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const id = o.id;
  const pid = typeof id === "number" && Number.isFinite(id) ? String(id) : typeof id === "string" ? id : null;
  if (!pid) return null;

  const inventoryType = firstTerm(o.listivo_14);
  if (inventoryType?.toLowerCase() === "auto") return null;

  const subtype = firstTerm(o.listivo_8359);
  const make = sanitizeImportLabel(firstTerm(o.listivo_945)) || null;
  const model = sanitizeImportLabel(firstTerm(o.listivo_946)) || null;
  const year = parseYear(firstTerm(o.listivo_4316));
  if (!make || !model || !year) return null;

  const odometerKm = parseOdometerKm(firstTerm(o.listivo_4686));
  const dealerStock = firstTerm(o.listivo_8113);
  const stock_number = dealerStock || `US-LIV-${pid}`;
  const link = typeof o.link === "string" && o.link.trim() ? o.link.trim() : null;
  const photoUrls = dedupeUrls(Array.isArray(o.listivo_145) ? (o.listivo_145 as string[]) : []);

  const titleObj = o.title;
  const title =
    titleObj && typeof titleObj === "object"
      ? (() => {
          const rendered = (titleObj as Record<string, unknown>).rendered;
          return typeof rendered === "string" && rendered.trim() ? rendered.trim() : null;
        })()
      : null;

  return {
    sourceProductId: pid,
    stockNumber: stock_number,
    year,
    make,
    model,
    odometerKm,
    category: mapListivoCategory(inventoryType, subtype),
    photoUrls,
    permalink: link,
    title,
    sourceNotes: link ? `Source: ${link}` : null,
    importSource
  };
}

async function fetchListivoPage(baseUrl: string, page: number): Promise<unknown[]> {
  const base = baseUrl.replace(/\/+$/, "");
  const url = `${base}/wp-json/wp/v2/listings?per_page=100&page=${page}&status=publish`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "TemptationMotorsportsImport/1.0" }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function* searchListivo(
  baseUrl: string,
  importSource: string,
  opts: SearchOpts
): AsyncGenerator<UsImportCandidate> {
  let yielded = 0;
  let scanned = 0;
  for (let page = 1; page <= 20 && yielded < opts.maxYields && scanned < opts.maxScans; page += 1) {
    let rows: unknown[];
    try {
      rows = await fetchListivoPage(baseUrl, page);
    } catch {
      break;
    }
    if (rows.length === 0) break;

    for (const row of rows) {
      if (yielded >= opts.maxYields || scanned >= opts.maxScans) return;
      scanned += 1;
      const candidate = mapListivoRow(row, importSource);
      if (!candidate || candidate.category !== opts.category) continue;
      const key = `${importSource}:${candidate.sourceProductId}`;
      if (opts.seenSourceIds.has(key)) continue;
      opts.seenSourceIds.add(key);
      yielded += 1;
      yield candidate;
    }
    if (rows.length < 100) break;
  }
}

function hostnameKey(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "").replace(/\./g, "_");
}

function slugFromPath(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  return parts[parts.length - 1] ?? null;
}

async function fetchListivoBySlug(baseUrl: string, slug: string): Promise<unknown | null> {
  const base = baseUrl.replace(/\/+$/, "");
  const url = `${base}/wp-json/wp/v2/listings?slug=${encodeURIComponent(slug)}&status=publish`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "TemptationMotorsportsImport/1.0" }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data) && data[0] ? data[0] : null;
}

export async function candidateFromListivoUrl(pageUrl: string): Promise<UsImportCandidate | null> {
  let parsed: URL;
  try {
    parsed = new URL(pageUrl);
  } catch {
    return null;
  }

  const base = `${parsed.protocol}//${parsed.hostname}`;
  const slug = slugFromPath(parsed.pathname);
  if (!slug) return null;

  const row = await fetchListivoBySlug(base, slug);
  if (!row) return null;

  const importSource = `url_listivo_${hostnameKey(parsed.hostname)}`;
  const candidate = mapListivoRow(row, importSource);
  if (!candidate) return null;
  return { ...candidate, permalink: pageUrl.split("#")[0] ?? candidate.permalink };
}
