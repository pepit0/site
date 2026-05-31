/**
 * Publish one import queue row to catalog (server-side photo fetch + upload).
 * Deploy: supabase functions deploy publish-import-queue-row
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const PHOTOS_BUCKET = "inventory-photos";
const PARALLEL_PHOTOS = 6;

type PublishBody = {
  queue_id: string;
  stock_number: string;
  year: number;
  make: string;
  model: string;
  odometer_km: number | null;
  category: string;
  source_photo_urls: string[];
  cost: number;
  status: string;
  admin_notes: string | null;
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

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

function normalizeStock(raw: string): string {
  return raw.trim().toUpperCase();
}

function isStockUniqueViolation(msg: string): boolean {
  return /duplicate key|unique constraint|already exists/i.test(msg);
}

async function fetchImage(url: string): Promise<{ blob: Blob; contentType: string | null }> {
  const res = await fetch(url, {
    headers: { Accept: "image/*,*/*", "User-Agent": "TemptationMotorsportsImport/1.0" },
    redirect: "follow"
  });
  if (!res.ok) throw new Error(`Image download failed (${res.status}) for ${url}`);
  const blob = await res.blob();
  return { blob, contentType: res.headers.get("Content-Type") };
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

async function publishRow(supabase: SupabaseClient, body: PublishBody) {
  const stock = normalizeStock(body.stock_number);
  if (!stock) throw new Error("Missing stock number.");
  if (!body.make?.trim() || !body.model?.trim()) throw new Error("Make and model required.");
  if (!Number.isFinite(body.year) || body.year < 1900 || body.year > 2100) throw new Error("Invalid year.");
  const urls = body.source_photo_urls.filter((u) => typeof u === "string" && u.trim());
  if (urls.length < 1) throw new Error("No source photos.");

  const { data: queueRow, error: qLoadErr } = await supabase
    .from("inventory_import_queue")
    .select("id,status")
    .eq("id", body.queue_id)
    .maybeSingle();
  if (qLoadErr) throw new Error(qLoadErr.message);
  if (!queueRow || queueRow.status !== "pending") throw new Error("Not pending.");

  const { data: dup } = await supabase.from("inventory_units").select("id").eq("stock_number", stock).maybeSingle();
  if (dup) throw new Error(`Stock #${stock} already in catalog.`);

  let unitId: string | null = null;
  const newPaths: string[] = [];

  try {
    const { data: inserted, error: insErr } = await supabase
      .from("inventory_units")
      .insert({
        stock_number: stock,
        year: body.year,
        make: body.make.trim(),
        model: body.model.trim(),
        odometer_km: body.odometer_km,
        category: body.category,
        cost: body.cost,
        status: body.status,
        photo_paths: [],
        admin_notes: body.admin_notes
      })
      .select("id")
      .single();
    if (insErr) {
      if (isStockUniqueViolation(insErr.message)) throw new Error(`Stock #${stock} already in catalog.`);
      throw new Error(insErr.message);
    }
    unitId = typeof inserted?.id === "string" ? inserted.id : null;
    if (!unitId) throw new Error("Invalid inventory response.");

    const downloaded = await mapPool(urls, PARALLEL_PHOTOS, async (url, index) => {
      const { blob, contentType } = await fetchImage(url);
      const ext = guessImageExt(url, contentType);
      const path = `${unitId}/import-${String(index).padStart(2, "0")}.${ext}`;
      const { error: upErr } = await supabase.storage.from(PHOTOS_BUCKET).upload(path, blob, {
        cacheControl: "3600",
        upsert: false
      });
      if (upErr) throw new Error(upErr.message);
      return path;
    });
    newPaths.push(...downloaded);

    const { error: upRowErr } = await supabase
      .from("inventory_units")
      .update({ photo_paths: newPaths })
      .eq("id", unitId);
    if (upRowErr) throw new Error(upRowErr.message);

    const { error: qErr } = await supabase
      .from("inventory_import_queue")
      .update({ status: "posted", imported_inventory_id: unitId })
      .eq("id", body.queue_id)
      .eq("status", "pending");
    if (qErr) throw new Error(qErr.message);

    return { ok: true as const, unitId, stock, error: null };
  } catch (e) {
    if (unitId) {
      if (newPaths.length) await supabase.storage.from(PHOTOS_BUCKET).remove(newPaths);
      await supabase.from("inventory_units").delete().eq("id", unitId);
    }
    throw e;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed", unitId: null, stock: null }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse({ ok: false, error: "Server misconfigured.", unitId: null, stock: null }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ ok: false, error: "Sign in required.", unitId: null, stock: null }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const {
    data: { user },
    error: userErr
  } = await userClient.auth.getUser();
  if (userErr || !user) {
    return jsonResponse({ ok: false, error: "Invalid or expired session.", unitId: null, stock: null }, 401);
  }

  const { data: canManage, error: rpcErr } = await userClient.rpc("user_can_manage_inventory");
  if (rpcErr) {
    return jsonResponse({ ok: false, error: rpcErr.message, unitId: null, stock: null }, 500);
  }
  if (!canManage) {
    return jsonResponse({ ok: false, error: "Inventory admin access required.", unitId: null, stock: null }, 403);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body.", unitId: null, stock: null }, 400);
  }

  if (!raw || typeof raw !== "object") {
    return jsonResponse({ ok: false, error: "Invalid body.", unitId: null, stock: null }, 400);
  }

  const b = raw as Record<string, unknown>;
  const body: PublishBody = {
    queue_id: typeof b.queue_id === "string" ? b.queue_id : "",
    stock_number: typeof b.stock_number === "string" ? b.stock_number : "",
    year: typeof b.year === "number" ? b.year : Number.parseInt(String(b.year ?? ""), 10),
    make: typeof b.make === "string" ? b.make : "",
    model: typeof b.model === "string" ? b.model : "",
    odometer_km:
      b.odometer_km == null
        ? null
        : typeof b.odometer_km === "number" && Number.isFinite(b.odometer_km)
          ? b.odometer_km
          : null,
    category: typeof b.category === "string" ? b.category : "",
    source_photo_urls: Array.isArray(b.source_photo_urls)
      ? b.source_photo_urls.filter((u): u is string => typeof u === "string")
      : [],
    cost: typeof b.cost === "number" ? b.cost : Number.parseFloat(String(b.cost ?? "")),
    status: typeof b.status === "string" ? b.status : "Available",
    admin_notes:
      b.admin_notes == null ? null : typeof b.admin_notes === "string" ? b.admin_notes.trim() || null : null
  };

  try {
    const result = await publishRow(
      createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }),
      body
    );
    return jsonResponse(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Publish failed.";
    return jsonResponse({ ok: false, error: msg, unitId: null, stock: normalizeStock(body.stock_number) || null });
  }
});
