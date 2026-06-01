import { isVehicleCategory, type VehicleCategory } from "./inventory";

export const INVENTORY_IMPORT_QUEUE_STATUSES = ["pending", "posted", "skipped"] as const;

export type InventoryImportQueueStatus = (typeof INVENTORY_IMPORT_QUEUE_STATUSES)[number];

export function isInventoryImportQueueStatus(value: string): value is InventoryImportQueueStatus {
  return (INVENTORY_IMPORT_QUEUE_STATUSES as readonly string[]).includes(value);
}

export type InventoryImportQueueRow = {
  id: string;
  import_source: string;
  source_product_id: string;
  stock_number: string;
  year: number | null;
  make: string | null;
  model: string | null;
  odometer_km: number | null;
  category: VehicleCategory;
  source_photo_urls: string[];
  source_permalink: string | null;
  source_product_name: string | null;
  source_notes: string | null;
  status: InventoryImportQueueStatus;
  imported_inventory_id: string | null;
  created_at: string;
  updated_at: string;
};

export function parseInventoryImportQueueRow(row: unknown): InventoryImportQueueRow | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = r.id;
  const import_source = r.import_source;
  const source_product_id = r.source_product_id;
  const stock_number = r.stock_number;
  const category = r.category;
  const status = r.status;
  const created_at = r.created_at;
  const updated_at = r.updated_at;
  if (typeof id !== "string") return null;
  if (typeof import_source !== "string" || typeof source_product_id !== "string") return null;
  if (typeof stock_number !== "string") return null;
  if (typeof category !== "string" || !isVehicleCategory(category)) return null;
  if (typeof status !== "string" || !isInventoryImportQueueStatus(status)) return null;
  if (typeof created_at !== "string" || typeof updated_at !== "string") return null;

  const yearRaw = r.year;
  const year =
    yearRaw == null
      ? null
      : typeof yearRaw === "number"
        ? Number.isFinite(yearRaw)
          ? yearRaw
          : null
        : typeof yearRaw === "string"
          ? (() => {
              const y = Number.parseInt(yearRaw, 10);
              return Number.isFinite(y) ? y : null;
            })()
          : null;

  const make = r.make == null ? null : typeof r.make === "string" ? r.make : null;
  const model = r.model == null ? null : typeof r.model === "string" ? r.model : null;

  const odometer_km = (() => {
    const k = r.odometer_km;
    if (k == null) return null;
    const n = typeof k === "number" ? k : typeof k === "string" ? Number.parseInt(k, 10) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : null;
  })();

  const rawUrls = r.source_photo_urls;
  const source_photo_urls = Array.isArray(rawUrls) ? rawUrls.filter((u): u is string => typeof u === "string") : [];

  const source_permalink =
    r.source_permalink == null ? null : typeof r.source_permalink === "string" ? r.source_permalink : null;
  const source_product_name =
    r.source_product_name == null ? null : typeof r.source_product_name === "string" ? r.source_product_name : null;

  const source_notes = r.source_notes == null ? null : typeof r.source_notes === "string" ? r.source_notes : null;

  const iid = r.imported_inventory_id;
  const imported_inventory_id = iid == null ? null : typeof iid === "string" ? iid : null;

  return {
    id,
    import_source,
    source_product_id,
    stock_number,
    year,
    make,
    model,
    odometer_km,
    category,
    source_photo_urls,
    source_permalink,
    source_product_name,
    source_notes,
    status,
    imported_inventory_id,
    created_at,
    updated_at
  };
}
