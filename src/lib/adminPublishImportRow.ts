import {
  INVENTORY_PHOTOS_BUCKET,
  parseInventoryUnitRow,
  type InventoryStatus
} from "../data/inventory";
import type { InventoryImportQueueRow } from "../data/inventoryImportQueue";
import { findInventoryUnitByStock, isStockNumberUniqueViolation, normalizeStockNumber } from "./inventoryStockDuplicate";
import { findStockConflict, stockConflictMessage } from "./tmsStockNumber";
import { downloadImportSourceImage } from "./downloadImportSourceImage";
import type { SupabaseClient } from "@supabase/supabase-js";

const PARALLEL_PHOTOS = 6;

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

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= items.length) break;
      results[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return results;
}

export type PublishImportRowOptions = {
  cost: number;
  status: InventoryStatus;
  adminNotes: string | null;
};

export type PublishImportRowResult =
  | { ok: true; unitId: string; stock: string }
  | { ok: false; stock: string; error: string };

type PublishEdgeResponse = {
  ok?: boolean;
  unitId?: string | null;
  stock?: string | null;
  error?: string | null;
};

type EdgePublishOutcome =
  | { type: "success"; result: Extract<PublishImportRowResult, { ok: true }> }
  | { type: "failure"; result: Extract<PublishImportRowResult, { ok: false }> }
  | { type: "unavailable" };

async function ensureFreshAdminSession(supabase: SupabaseClient): Promise<void> {
  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Sign in required.");
  }
  const expiresAt = session.expires_at ?? 0;
  const nowSec = Math.floor(Date.now() / 1000);
  if (expiresAt - nowSec < 120) {
    const { error } = await supabase.auth.refreshSession();
    if (error) {
      throw new Error(`Session expired (${error.message}). Sign in again and retry.`);
    }
  }
}

/** After a timeout or network error, check whether the edge publish actually succeeded. */
async function reconcilePublishState(
  supabase: SupabaseClient,
  row: InventoryImportQueueRow,
  stock: string
): Promise<Extract<PublishImportRowResult, { ok: true }> | null> {
  const { data: queueRow, error: qErr } = await supabase
    .from("inventory_import_queue")
    .select("status, imported_inventory_id")
    .eq("id", row.id)
    .maybeSingle();
  if (qErr) return null;

  if (queueRow?.status === "posted" && typeof queueRow.imported_inventory_id === "string") {
    return { ok: true, unitId: queueRow.imported_inventory_id, stock };
  }

  const dup = await findInventoryUnitByStock(supabase, stock);
  if (!dup) return null;

  if (queueRow?.status === "pending") {
    await supabase
      .from("inventory_import_queue")
      .update({ status: "posted", imported_inventory_id: dup.id })
      .eq("id", row.id)
      .eq("status", "pending");
  }

  return { ok: true, unitId: dup.id, stock };
}

function isEdgeUnavailableMessage(message: string): boolean {
  return /404|not found|function not found/i.test(message);
}

function isLikelyNetworkError(message: string): boolean {
  return /failed to fetch|network|timeout|timed out|aborted|connection|load failed/i.test(message);
}

/** Server-side publish (parallel photos, no per-image browser round trips). */
async function publishViaEdgeFunction(
  supabase: SupabaseClient,
  row: InventoryImportQueueRow,
  options: PublishImportRowOptions
): Promise<EdgePublishOutcome> {
  const stock = normalizeStockNumber(row.stock_number);
  const { data, error } = await supabase.functions.invoke("publish-import-queue-row", {
    method: "POST",
    body: {
      queue_id: row.id,
      stock_number: stock,
      year: row.year,
      make: row.make,
      model: row.model,
      odometer_km: row.odometer_km,
      category: row.category,
      source_photo_urls: row.source_photo_urls,
      cost: options.cost,
      status: options.status,
      admin_notes: options.adminNotes
    }
  });

  if (error) {
    if (isEdgeUnavailableMessage(error.message)) {
      return { type: "unavailable" };
    }

    const reconciled = await reconcilePublishState(supabase, row, stock);
    if (reconciled) {
      return { type: "success", result: reconciled };
    }

    return {
      type: "failure",
      result: {
        ok: false,
        stock: stock || row.stock_number,
        error: isLikelyNetworkError(error.message)
          ? `Connection lost posting #${stock}. Check the catalog — if the unit is there, it posted; otherwise retry.`
          : error.message
      }
    };
  }

  const body = data as PublishEdgeResponse | null;
  if (!body || typeof body !== "object") {
    const reconciled = await reconcilePublishState(supabase, row, stock);
    if (reconciled) {
      return { type: "success", result: reconciled };
    }
    return {
      type: "failure",
      result: { ok: false, stock: stock || row.stock_number, error: "Empty publish response." }
    };
  }

  if (body.ok === true && typeof body.unitId === "string") {
    return {
      type: "success",
      result: { ok: true, unitId: body.unitId, stock: typeof body.stock === "string" ? body.stock : stock }
    };
  }

  const errStock = typeof body.stock === "string" ? body.stock : stock || row.stock_number;
  const errMsg = typeof body.error === "string" ? body.error : "Publish failed.";

  const reconciled = await reconcilePublishState(supabase, row, stock);
  if (reconciled) {
    return { type: "success", result: reconciled };
  }

  return {
    type: "failure",
    result: { ok: false, stock: errStock, error: errMsg }
  };
}

async function downloadPhotosInBrowser(
  supabase: SupabaseClient,
  unitId: string,
  urls: string[]
): Promise<string[]> {
  const results = await mapPool(urls, PARALLEL_PHOTOS, async (imageUrl, index) => {
    try {
      const blob = await downloadImportSourceImage(supabase, imageUrl);
      const ext = guessImageExt(imageUrl, blob.type || null);
      const nextPath = `${unitId}/import-${String(index).padStart(2, "0")}.${ext}`;
      const { error: upErr } = await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).upload(nextPath, blob, {
        cacheControl: "3600",
        upsert: false
      });
      if (upErr) return null;
      return nextPath;
    } catch {
      return null;
    }
  });
  return results.filter((p): p is string => typeof p === "string");
}

/** Browser fallback when edge publish is unavailable (parallelized). */
async function publishInBrowser(
  supabase: SupabaseClient,
  row: InventoryImportQueueRow,
  options: PublishImportRowOptions
): Promise<PublishImportRowResult> {
  const stock = normalizeStockNumber(row.stock_number);
  if (!stock) {
    return { ok: false, stock: row.stock_number, error: "Missing stock number." };
  }

  let unitId: string | null = null;
  const newPaths: string[] = [];
  try {
    const { data: inserted, error: insErr } = await supabase
      .from("inventory_units")
      .insert({
        stock_number: stock,
        year: row.year,
        make: row.make!.trim(),
        model: row.model!.trim(),
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
        const reconciled = await reconcilePublishState(supabase, row, stock);
        if (reconciled) return reconciled;
        return { ok: false, stock, error: `Stock #${stock} already in catalog.` };
      }
      throw new Error(insErr.message);
    }
    const parsed = parseInventoryUnitRow(inserted);
    if (!parsed) throw new Error("Invalid inventory response.");
    unitId = parsed.id;

    newPaths.push(...(await downloadPhotosInBrowser(supabase, unitId, row.source_photo_urls)));
    if (newPaths.length < 1) {
      throw new Error("No photos could be downloaded.");
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
      if (newPaths.length) await supabase.storage.from(INVENTORY_PHOTOS_BUCKET).remove(newPaths);
      await supabase.from("inventory_units").delete().eq("id", unitId);
    }
    return { ok: false, stock, error: msg };
  }
}

export async function publishImportQueueRow(
  supabase: SupabaseClient,
  row: InventoryImportQueueRow,
  options: PublishImportRowOptions
): Promise<PublishImportRowResult> {
  await ensureFreshAdminSession(supabase);

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
    const conflict = await findStockConflict(supabase, stock, { excludeQueueId: row.id });
    if (conflict) {
      if (conflict.kind === "catalog") {
        const reconciled = await reconcilePublishState(supabase, row, stock);
        if (reconciled) return reconciled;
      }
      return { ok: false, stock, error: stockConflictMessage(conflict, stock) };
    }
  } catch (e) {
    return { ok: false, stock, error: e instanceof Error ? e.message : "Stock check failed." };
  }

  const edge = await publishViaEdgeFunction(supabase, row, options);
  if (edge.type === "success") return edge.result;
  if (edge.type === "failure") return edge.result;

  return publishInBrowser(supabase, row, options);
}
