import { parseInventoryListPriceCad } from "./inventory-seo.mjs";

const PUBLIC_STATUSES = new Set(["Available", "Pending", "Sold"]);
const CATEGORIES = new Set([
  "Motorcycle",
  "ATV",
  "Snowmobile",
  "Side by side",
  "Watercraft",
  "Trailer"
]);

/**
 * @param {unknown} row
 */
export function parsePublicInventoryRow(row) {
  if (!row || typeof row !== "object") return null;
  const r = row;
  if (typeof r.id !== "string" || typeof r.stock_number !== "string") return null;
  if (typeof r.make !== "string" || typeof r.model !== "string") return null;
  if (typeof r.year !== "number" || !Number.isFinite(r.year)) return null;
  if (typeof r.category !== "string" || !CATEGORIES.has(r.category)) return null;
  if (typeof r.status !== "string" || !PUBLIC_STATUSES.has(r.status)) return null;
  if (typeof r.created_at !== "string" || typeof r.updated_at !== "string") return null;

  let odometer_km = null;
  if (r.odometer_km != null) {
    const k =
      typeof r.odometer_km === "number"
        ? r.odometer_km
        : typeof r.odometer_km === "string"
          ? Number(r.odometer_km)
          : NaN;
    if (Number.isFinite(k) && k >= 0) odometer_km = k;
  }

  const photo_paths = Array.isArray(r.photo_paths)
    ? r.photo_paths.filter((p) => typeof p === "string")
    : [];

  return {
    id: r.id,
    stock_number: r.stock_number,
    year: r.year,
    make: r.make,
    model: r.model,
    odometer_km,
    category: r.category,
    status: r.status,
    photo_paths,
    list_price_cad: parseInventoryListPriceCad(r.list_price_cad),
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

/**
 * @param {{ supabaseUrl: string; supabaseAnonKey: string }} config
 */
export async function fetchPublicInventoryUnits(config) {
  const { supabaseUrl, supabaseAnonKey } = config;
  if (!supabaseUrl || !supabaseAnonKey) {
    return { rows: [], error: "missing_supabase_env" };
  }

  const baseUrl = `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/inventory_units_public`;
  const pageSize = 1000;
  /** @type {ReturnType<typeof parsePublicInventoryRow>[]} */
  const rows = [];
  let offset = 0;

  while (true) {
    const url = new URL(baseUrl);
    url.searchParams.set(
      "select",
      "id,stock_number,year,make,model,odometer_km,category,status,photo_paths,list_price_cad,created_at,updated_at"
    );
    url.searchParams.set("order", "updated_at.desc");
    url.searchParams.set("limit", String(pageSize));
    url.searchParams.set("offset", String(offset));

    const res = await fetch(url, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        Accept: "application/json"
      }
    });

    if (!res.ok) {
      const text = await res.text();
      return { rows: [], error: `supabase_${res.status}: ${text.slice(0, 200)}` };
    }

    const data = await res.json();
    if (!Array.isArray(data)) return { rows: [], error: "invalid_response" };

    const page = data.map(parsePublicInventoryRow).filter(Boolean);
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  return { rows, error: null };
}
