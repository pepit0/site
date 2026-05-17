import {
  INVENTORY_PHOTOS_BUCKET,
  parseInventoryUnitRow,
  type InventoryStatus
} from "../data/inventory";
import type { InventoryImportQueueRow } from "../data/inventoryImportQueue";
import { findInventoryUnitByStock, isStockNumberUniqueViolation, normalizeStockNumber } from "./inventoryStockDuplicate";
import type { SupabaseClient } from "@supabase/supabase-js";

function guessImageExt(url: string, contentType: string | null): string {
  const path = (url.split("?")[0] ?? "").toLowerCase();
  if (path.endsWith(".png")) return "png";
  if (path.endsWith(".webp")) return "webp";
  if (path.endsWith(".gif")) return "gif";
  if (path.endsWith(".jpeg") || path.endsWith(".jpg")) return "jpg";
  const ct = contentType?.toLowerCase() ?? "";
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  return "jpg";
}

async function downloadUrlAsBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { mode: "cors", credentials: "omit", cache: "no-store" });
  if (!res.ok) throw new Error(`Image download failed (${res.status})`);
  return res.blob();
}

export type PublishImportRowOptions = {
  cost: number;
  status: InventoryStatus;
  adminNotes: string | null;
};

export type PublishImportRowResult =
  | { ok: true; unitId: string; stock: string }
  | { ok: false; stock: string; error: string };

export async function publishImportQueueRow(
  supabase: SupabaseClient,
  row: InventoryImportQueueRow,
  options: PublishImportRowOptions
): Promise<PublishImportRowResult> {
  const stock = normalizeStockNumber(row.stock_number);
  if (!stock) {
    return { ok: false, stock: row.stock_number, error: "Missing stock number." };
  }
  if (row.status !== "pending") {
    return { ok: false, stock, error: "Not pending." };
  }
  if (!row.make?.trim() || !row.model?.trim()) {
    return { ok: false, stock, error: "Make and model required." };
  }
  if (row.year == null || row.year < 1900 || row.year > 2100) {
    return { ok: false, stock, error: "Invalid year." };
  }
  if (row.source_photo_urls.length < 1) {
    return { ok: false, stock, error: "No source photos." };
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
  try {
    const { data: inserted, error: insErr } = await supabase
      .from("inventory_units")
      .insert({
        stock_number: stock,
        year: row.year,
        make: row.make.trim(),
        model: row.model.trim(),
        odometer_km: row.odometer_km,
        category: row.category,
        cost: options.cost,
        status: options.status,
        photo_paths: [],
        admin_notes: options.adminNotes
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

    let i = 0;
    for (const imageUrl of row.source_photo_urls) {
      const blob = await downloadUrlAsBlob(imageUrl);
      const ext = guessImageExt(imageUrl, blob.type || null);
      const nextPath = `${unitId}/import-${String(i).padStart(2, "0")}.${ext}`;
      const { error: upErr } = await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).upload(nextPath, blob, {
        cacheControl: "3600",
        upsert: false
      });
      if (upErr) throw new Error(upErr.message);
      newPaths.push(nextPath);
      i += 1;
    }

    const { error: upRowErr } = await supabase.from("inventory_units").update({ photo_paths: newPaths }).eq("id", unitId);
    if (upRowErr) throw new Error(upRowErr.message);

    const { error: qErr } = await supabase
      .from("inventory_import_queue")
      .update({ status: "posted", imported_inventory_id: unitId })
      .eq("id", row.id)
      .eq("status", "pending");
    if (qErr) throw new Error(qErr.message);

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
