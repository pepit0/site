/**
 * CRM Edge Function: ingest-marketing-preapproval
 *
 * Receives marketing DB webhook POST (from notify_preapproval_lead_to_crm / pg_net).
 * Forwards the **entire** JSON body to public.ingest_marketing_preapproval_lead(p_payload).
 *
 * Do NOT narrow the payload to a small PreapprovalRecord — that drops extended fields
 * (monthly_budget_cad, employment_status, credit_score_band, trade_*, job_title, etc.).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-marketing-webhook-secret",
};

/** Envelope from marketing trigger (to_jsonb(NEW) inside `record`). */
type MarketingWebhookPayload = {
  type?: "INSERT" | "UPDATE" | "DELETE";
  table?: string;
  schema?: string;
  record?: Record<string, unknown>;
  old_record?: Record<string, unknown> | null;
  // Some proxies wrap again — ingest SQL unwraps these too.
  data?: { record?: Record<string, unknown> };
  body?: { record?: Record<string, unknown> };
  message?: MarketingWebhookPayload | string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  const expected = Deno.env.get("MARKETING_WEBHOOK_SECRET");
  const got =
    req.headers.get("X-Marketing-Webhook-Secret") ??
    req.headers.get("x-marketing-webhook-secret");
  if (!expected || got !== expected) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: MarketingWebhookPayload;
  try {
    payload = (await req.json()) as MarketingWebhookPayload;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const record = payload.record ?? payload.data?.record ?? payload.body?.record;
  if (record && typeof record === "object") {
    const keys = Object.keys(record);
    console.log(
      "ingest-marketing-preapproval record keys:",
      keys.length,
      keys.slice(0, 12).join(","),
      keys.length > 12 ? "…" : "",
    );
    if (!("id" in record) && !("marketing_lead_id" in record)) {
      console.warn("ingest-marketing-preapproval: record missing id");
    }
    if (!("monthly_budget_cad" in record) && !("employment_status" in record)) {
      console.warn(
        "ingest-marketing-preapproval: record looks sparse (no extended columns)",
      );
    }
  } else {
    console.warn("ingest-marketing-preapproval: no record object on payload");
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await supabase.rpc("ingest_marketing_preapproval_lead", {
    p_payload: payload,
  });

  if (error) {
    console.error("ingest_marketing_preapproval_lead", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(data ?? { ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
