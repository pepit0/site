import { isVehicleCategory, type VehicleCategory } from "./inventory";

export const SELL_RIDE_PHOTOS_BUCKET = "sell-ride-photos" as const;

export type SellRideSubmissionStatus = "draft" | "submitted" | "published" | "rejected";

export type SellRideSubmissionRow = {
  id: string;
  status: SellRideSubmissionStatus;
  seller_first_name: string | null;
  seller_last_name: string | null;
  seller_phone: string | null;
  seller_email: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  odometer_km: number | null;
  category: VehicleCategory | null;
  seller_notes: string | null;
  admin_notes: string | null;
  photo_paths: string[];
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  published_inventory_id: string | null;
  rejected_reason: string | null;
};

export function isSellRideSubmissionStatus(value: string): value is SellRideSubmissionStatus {
  return value === "draft" || value === "submitted" || value === "published" || value === "rejected";
}

export function parseSellRideSubmissionRow(row: unknown): SellRideSubmissionRow | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = r.id;
  const status = r.status;
  if (typeof id !== "string" || typeof status !== "string" || !isSellRideSubmissionStatus(status)) return null;

  const seller_first_name = typeof r.seller_first_name === "string" ? r.seller_first_name : null;
  const seller_last_name = typeof r.seller_last_name === "string" ? r.seller_last_name : null;
  const seller_phone = typeof r.seller_phone === "string" ? r.seller_phone : null;
  const seller_email = typeof r.seller_email === "string" ? r.seller_email : null;

  const year = typeof r.year === "number" && Number.isFinite(r.year) ? r.year : null;
  const make = typeof r.make === "string" ? r.make : null;
  const model = typeof r.model === "string" ? r.model : null;

  const odometer_km =
    r.odometer_km == null
      ? null
      : typeof r.odometer_km === "number" && Number.isFinite(r.odometer_km)
        ? r.odometer_km
        : null;

  const catRaw = r.category;
  const category =
    typeof catRaw === "string" && isVehicleCategory(catRaw) ? (catRaw as VehicleCategory) : null;

  const seller_notes = typeof r.seller_notes === "string" ? r.seller_notes : null;
  const admin_notes = typeof r.admin_notes === "string" ? r.admin_notes : null;

  const rawPaths = r.photo_paths;
  const photo_paths = Array.isArray(rawPaths)
    ? rawPaths.filter((p): p is string => typeof p === "string")
    : [];

  const created_at = typeof r.created_at === "string" ? r.created_at : null;
  const updated_at = typeof r.updated_at === "string" ? r.updated_at : null;
  const submitted_at = typeof r.submitted_at === "string" ? r.submitted_at : null;
  const published_inventory_id =
    typeof r.published_inventory_id === "string" ? r.published_inventory_id : null;
  const rejected_reason = typeof r.rejected_reason === "string" ? r.rejected_reason : null;

  if (!created_at || !updated_at) return null;

  return {
    id,
    status,
    seller_first_name,
    seller_last_name,
    seller_phone,
    seller_email,
    year,
    make,
    model,
    odometer_km,
    category,
    seller_notes,
    admin_notes,
    photo_paths,
    created_at,
    updated_at,
    submitted_at,
    published_inventory_id,
    rejected_reason
  };
}
