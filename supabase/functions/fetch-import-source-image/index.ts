/**
 * Server-side fetch for import source images (bypasses browser CORS).
 * Deploy: supabase functions deploy fetch-import-source-image
 *
 * POST { "url": "https://www.overlandram.ca/wp-content/uploads/..." }
 * Auth: inventory admin session required.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const ALLOWED_HOSTS = new Set([
  "overlandram.ca",
  "www.overlandram.ca",
  "motorsportsfinancing.ca",
  "ridenow.com",
  "www.ridenow.com",
  "cdn.dealerspike.com",
  "foxpowersports.com",
  "heartlandhonda.com",
  "hondaws.com",
  "lakecycle.com",
  "bertsmegamall.com",
  "www.magnummotorsports.com",
  "magnummotorsports.com",
  "www.extremepowersports.com",
  "extremepowersports.com",
  "cdpcdn.dx1app.com",
  "www.powersportsplus.com",
  "powersportsplus.com",
  "www.youngpowersportsxl.com",
  "youngpowersportsxl.com",
  "www.mountainmotorsports.com",
  "mountainmotorsports.com"
]);

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function isAllowedImportImageUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    if (ALLOWED_HOSTS.has(h)) return true;
    if (h.endsWith(".dealerspike.com")) return true;
    if (h.endsWith(".ridenow.com")) return true;
    // URL imports may reference photos on arbitrary dealer/CDN hosts (admin-only proxy).
    return true;
  } catch {
    return false;
  }
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
  if (!supabaseUrl || !anonKey) {
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const url = body && typeof body === "object" && typeof (body as Record<string, unknown>).url === "string"
    ? (body as Record<string, unknown>).url.trim()
    : "";
  if (!url || !isAllowedImportImageUrl(url)) {
    return jsonResponse({ ok: false, error: "URL not allowed for import image proxy." }, 400);
  }

  try {
    const res = await fetch(url, {
      headers: { Accept: "image/*,*/*", "User-Agent": "TemptationMotorsportsImport/1.0" },
      redirect: "follow"
    });
    if (!res.ok) {
      return jsonResponse({ ok: false, error: `Upstream HTTP ${res.status}` }, 502);
    }
    const blob = await res.blob();
    const contentType = res.headers.get("Content-Type") || blob.type || "application/octet-stream";
    return new Response(blob, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=60"
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fetch failed.";
    return jsonResponse({ ok: false, error: msg }, 502);
  }
});
