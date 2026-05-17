import {
  INVENTORY_PHOTOS_BUCKET,
  parseInventoryUnitRow,
  type InventoryStatus,
  type VehicleCategory
} from "../data/inventory";
import type { SellRideSubmissionRow } from "../data/sellRide";
import { SELL_RIDE_PHOTOS_BUCKET } from "../data/sellRide";
import { findInventoryUnitByStock, isStockNumberUniqueViolation, normalizeStockNumber } from "./inventoryStockDuplicate";
import { validateSellPublishCompliance } from "./sellPublishCompliance";
import type { SupabaseClient } from "@supabase/supabase-js";

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

export type PublishSellSubmissionOptions = {
  stock: string;
  cost: number;
  status: InventoryStatus;
  vin: string;
  hasRegistration: boolean;
  hasInsurance: boolean;
  noRegInsurance: boolean;
};

export type PublishSellSubmissionResult =
  | { ok: true; unitId: string; stock: string }
  | { ok: false; stock: string; error: string };

export async function publishSellSubmissionRow(
  supabase: SupabaseClient,
  row: SellRideSubmissionRow,
  options: PublishSellSubmissionOptions
): Promise<PublishSellSubmissionResult> {
  const stock = normalizeStockNumber(options.stock);
  if (!stock) {
    return { ok: false, stock: options.stock, error: "Stock number required." };
  }
  if (row.status !== "submitted") {
    return { ok: false, stock, error: "Not submitted." };
  }
  const vin = options.vin.trim();
  if (!vin) {
    return { ok: false, stock, error: "VIN required." };
  }
  const complianceErr = validateSellPublishCompliance({
    hasRegistration: options.hasRegistration,
    hasInsurance: options.hasInsurance,
    noRegInsurance: options.noRegInsurance
  });
  if (complianceErr) {
    return { ok: false, stock, error: complianceErr };
  }
  if (row.photo_paths.length < 1) {
    return { ok: false, stock, error: "No photos." };
  }
  if (row.year == null || row.odometer_km == null || !row.make?.trim() || !row.model?.trim()) {
    return { ok: false, stock, error: "Incomplete vehicle details." };
  }

  try {
    const dup = await findInventoryUnitByStock(supabase, stock);
    if (dup) {
      return { ok: false, stock, error: `Stock #${stock} already in catalog.` };
    }
  } catch (e) {
    return { ok: false, stock, error: e instanceof Error ? e.message : "Stock check failed." };
  }

  let unitId: string | null = null;
  const newPaths: string[] = [];
  const category = (row.category ?? "Motorcycle") as VehicleCategory;

  try {
    const { data: inserted, error: insErr } = await supabase
      .from("inventory_units")
      .insert({
        stock_number: stock,
        year: row.year,
        make: row.make.trim(),
        model: row.model.trim(),
        odometer_km: row.odometer_km,
        category,
        cost: options.cost,
        status: options.status,
        photo_paths: [],
        vin,
        is_customer_unit: true,
        sell_ride_submission_id: row.id,
        has_registration: options.noRegInsurance ? false : options.hasRegistration,
        has_insurance: options.noRegInsurance ? false : options.hasInsurance,
        no_reg_insurance: options.noRegInsurance
      })
      .select("*")
      .single();
    if (insErr) {
      if (isStockNumberUniqueViolation(insErr.message)) {
        return { ok: false, stock, error: `Stock #${stock} already in catalog.` };
      }
      throw new Error(insErr.message);
    }
    const parsed = parseInventoryUnitRow(inserted);
    if (!parsed) throw new Error("Invalid inventory response.");
    unitId = parsed.id;

    for (const oldPath of row.photo_paths) {
      const { data: blob, error: dlErr } = await supabase.storage.from(SELL_RIDE_PHOTOS_BUCKET).download(oldPath);
      if (dlErr || !blob) throw new Error(dlErr?.message ?? "Photo download failed.");
      const baseName = oldPath.includes("/") ? oldPath.slice(oldPath.lastIndexOf("/") + 1) : oldPath;
      const nextPath = `${unitId}/${sanitizeFileName(baseName)}`;
      const { error: upErr } = await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).upload(nextPath, blob, {
        cacheControl: "3600",
        upsert: false
      });
      if (upErr) throw new Error(upErr.message);
      newPaths.push(nextPath);
    }

    const { error: upRowErr } = await supabase.from("inventory_units").update({ photo_paths: newPaths }).eq("id", unitId);
    if (upRowErr) throw new Error(upRowErr.message);

    const { error: subErr } = await supabase
      .from("sell_ride_submissions")
      .update({ status: "published", published_inventory_id: unitId })
      .eq("id", row.id)
      .eq("status", "submitted");
    if (subErr) throw new Error(subErr.message);

    return { ok: true, unitId, stock };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Publish failed.";
    if (unitId) {
      if (newPaths.length) {
        await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).remove(newPaths);
      }
      await supabase.from("inventory_units").delete().eq("id", unitId);
    }
    return { ok: false, stock, error: msg };
  }
}

/** Assign sequential stock numbers from a numeric starting stock. */
export function stockNumberForMassSellIndex(startStock: string, index: number): string {
  const base = normalizeStockNumber(startStock);
  const n = Number.parseInt(base, 10);
  if (Number.isFinite(n)) {
    return String(n + index);
  }
  return index === 0 ? base : `${base}-${index + 1}`;
}
