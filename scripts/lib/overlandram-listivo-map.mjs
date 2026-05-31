/** Shared Listivo listing → import queue row mapping for Overland RAM. */

export const IMPORT_SOURCE = "overlandram_listivo";
export const LISTIVO_API_BASE = "https://www.overlandram.ca/wp-json/wp/v2/listings";
export const PER_PAGE = 100;

/** @param {unknown} v */
export function firstTerm(v) {
  if (!Array.isArray(v) || v.length < 1) return null;
  const t = v[0];
  return typeof t === "string" && t.trim() ? t.trim() : null;
}

/** @param {unknown} raw */
export function parseOdometerKm(raw) {
  if (raw == null) return null;
  const s = typeof raw === "string" ? raw : String(raw);
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return null;
  const k = Number.parseInt(digits, 10);
  return Number.isFinite(k) && k >= 0 ? k : null;
}

/** @param {unknown} raw */
export function parseYear(raw) {
  if (raw == null) return null;
  const y = Number.parseInt(String(raw).replace(/\D/g, ""), 10);
  return Number.isFinite(y) && y >= 1900 && y <= 2100 ? y : null;
}

/**
 * @param {string | null | undefined} type listivo_14 e.g. Motorsport, Marine, RV, Auto
 * @param {string | null | undefined} subtype listivo_8359 e.g. ATV, Side-by-Side, Travel Trailer
 */
export function mapListivoCategory(type, subtype) {
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

/** @param {unknown} urls */
export function dedupePhotoUrls(urls) {
  const seen = new Set();
  const out = [];
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

/**
 * Map a Listivo REST listing to a queue upsert row, or null if Auto / invalid.
 * @param {unknown} row
 */
export function mapListivoListing(row) {
  if (!row || typeof row !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (row);
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
  const source_product_name =
    titleObj && typeof titleObj === "object"
      ? (() => {
          const rendered = /** @type {Record<string, unknown>} */ (titleObj).rendered;
          return typeof rendered === "string" && rendered.trim() ? rendered.trim() : null;
        })()
      : null;

  const link = typeof o.link === "string" && o.link.trim() ? o.link.trim() : null;
  const source_photo_urls = dedupePhotoUrls(o.listivo_145);

  return {
    import_source: IMPORT_SOURCE,
    source_product_id: pid,
    stock_number,
    year,
    make,
    model,
    odometer_km,
    category: mapListivoCategory(inventoryType, subtype),
    source_photo_urls,
    source_permalink: link,
    source_product_name
  };
}
