/**
 * Import a single listing from a pasted URL into inventory_import_queue.
 * Deploy: supabase functions deploy import-url-to-queue
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  importCandidateFromUrl,
  passesUrlImportFilter,
  previewFromCandidate
} from "../_shared/us-import/import-from-url.ts";
import type { UsImportCandidate } from "../_shared/us-import/types.ts";
import {
  appendDealerStockNote,
  createTmsStockAllocator,
  loadAllReservedStockNumbers
} from "../_shared/tms-stock.ts";

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

async function queueCandidate(
  supabase: SupabaseClient,
  candidate: UsImportCandidate,
  stock: string,
  sourceNotes: string | null
): Promise<{ ok: true; duplicate: false } | { ok: false; duplicate: boolean; message: string }> {
  const baseRow = {
    import_source: candidate.importSource,
    source_product_id: candidate.sourceProductId,
    stock_number: stock,
    year: candidate.year,
    make: candidate.make,
    model: candidate.model,
    odometer_km: candidate.odometerKm,
    category: candidate.category,
    source_photo_urls: candidate.photoUrls,
    source_permalink: candidate.permalink,
    source_product_name: candidate.title,
    status: "pending" as const
  };

  let { error } = await supabase.from("inventory_import_queue").upsert(
    { ...baseRow, source_notes: sourceNotes },
    { onConflict: "import_source,source_product_id", ignoreDuplicates: true }
  );

  if (error && /source_notes/i.test(error.message)) {
    ({ error } = await supabase.from("inventory_import_queue").upsert(baseRow, {
      onConflict: "import_source,source_product_id",
      ignoreDuplicates: true
    }));
  }

  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return { ok: false, duplicate: true, message: "This listing is already in the import queue." };
    }
    return { ok: false, duplicate: false, message: error.message };
  }

  return { ok: true, duplicate: false };
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

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const dryRun = body?.dryRun === true;

  if (!url) {
    return jsonResponse({ ok: false, error: "url is required." }, 400);
  }

  try {
    const parsed = await importCandidateFromUrl(url);
    if (!parsed.ok) {
      return jsonResponse({ ok: false, error: parsed.error, attempts: parsed.attempts }, 422);
    }

    const preview = previewFromCandidate(parsed.candidate, parsed.adapter);
    const quality = passesUrlImportFilter(parsed.candidate);
    if (!quality.ok) {
      return jsonResponse({ ok: false, error: quality.reason, preview, attempts: parsed.attempts }, 422);
    }

    if (dryRun) {
      return jsonResponse({ ok: true, dryRun: true, preview, attempts: parsed.attempts });
    }

    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const reserved = await loadAllReservedStockNumbers(serviceClient);
    const tmsStock = createTmsStockAllocator(reserved);
    const stock = tmsStock.next();
    const sourceNotes = appendDealerStockNote(
      parsed.candidate.sourceNotes?.trim()
        ? `${parsed.candidate.sourceNotes.trim()}\nImported from pasted link`
        : `Imported from pasted link\nSource: ${url}`,
      parsed.candidate.stockNumber
    );

    const queued = await queueCandidate(serviceClient, parsed.candidate, stock, sourceNotes);
    if (!queued.ok) {
      return jsonResponse(
        { ok: false, error: queued.message, duplicate: queued.duplicate, preview, attempts: parsed.attempts },
        queued.duplicate ? 409 : 500
      );
    }

    return jsonResponse({ ok: true, queued: true, preview, stock, attempts: parsed.attempts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Import from URL failed.";
    return jsonResponse({ ok: false, error: msg }, 500);
  }
});
