import type { SupabaseClient } from "@supabase/supabase-js";
import { inventoryPhotoPublicUrl } from "./supabaseAdmin";

const KM_TO_MILES = 0.621371;

export type InventoryUnitDbRow = {
  id: string;
  year: number;
  make: string;
  model: string;
  odometer_km: number | null;
  cost: number;
  vin: string | null;
  photo_paths: string[] | null;
  status: string;
  posted_to_marketplace: boolean;
  marketplace_listed_at: string | null;
  marketplace_list_price: number | null;
};

export type ExtensionInventoryVehicle = {
  id: string;
  year: number;
  make: string;
  model: string;
  price: number;
  mileage: number;
  vin: string;
  photos: string[];
  posted_to_marketplace: boolean;
  marketplace_listed_at: string | null;
};

function kmToMiles(km: number | null): number {
  if (km == null || !Number.isFinite(km) || km < 0) {
    return 0;
  }
  return Math.round(km * KM_TO_MILES);
}

function resolvePrice(row: InventoryUnitDbRow): number {
  const listPrice = row.marketplace_list_price;
  if (listPrice != null && Number.isFinite(Number(listPrice))) {
    return Math.round(Number(listPrice));
  }
  const cost = Number(row.cost);
  return Number.isFinite(cost) ? Math.round(cost) : 0;
}

export function mapRowToExtensionVehicle(
  row: InventoryUnitDbRow,
  supabase: SupabaseClient
): ExtensionInventoryVehicle {
  const paths = Array.isArray(row.photo_paths) ? row.photo_paths : [];
  const photos = paths
    .filter((p): p is string => typeof p === "string" && p.length > 0)
    .map((p) => inventoryPhotoPublicUrl(supabase, p));

  return {
    id: row.id,
    year: row.year,
    make: row.make,
    model: row.model,
    price: resolvePrice(row),
    mileage: kmToMiles(row.odometer_km),
    vin: row.vin ?? "",
    photos,
    posted_to_marketplace: row.posted_to_marketplace === true,
    marketplace_listed_at: row.marketplace_listed_at ?? null
  };
}
