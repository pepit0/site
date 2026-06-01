/**
 * Bulk sync all used units from configured US import sources into inventory_import_queue.
 * Skips rows already in queue (import_source + source_product_id). Safe to re-run for new listings only.
 * Deploy: supabase functions deploy bulk-sync-us-import-queue
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { bulkSyncUsImportSources } from "../_shared/us-import/bulk-catalog-sync.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse({ ok: false, error: "Server misconfigured." }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ ok: false, error: "Sign in required." }, 401);
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
    return jsonResponse({ ok: false, error: "Invalid or expired session." }, 401);
  }

  const { data: canManage, error: rpcErr } = await userClient.rpc("user_can_manage_inventory");
  if (rpcErr) {
    return jsonResponse({ ok: false, error: rpcErr.message }, 500);
  }
  if (!canManage) {
    return jsonResponse({ ok: false, error: "Inventory admin access required." }, 403);
  }

  let raw: unknown = {};
  try {
    if (req.headers.get("Content-Length") !== "0") {
      raw = await req.json();
    }
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const b = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const sourceIds = Array.isArray(b.sourceIds)
    ? b.sourceIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : undefined;
  const minPhotos = typeof b.minPhotos === "number" && Number.isFinite(b.minPhotos) ? Math.floor(b.minPhotos) : undefined;

  try {
    const stats = await bulkSyncUsImportSources(
      createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }),
      { sourceIds, minPhotos }
    );
    return jsonResponse({ ok: true, stats });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bulk sync failed.";
    return jsonResponse({ ok: false, error: msg }, 500);
  }
});
