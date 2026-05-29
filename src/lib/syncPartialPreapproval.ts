import type { PreapprovalErasedFields } from "./preapprovalErasedFields";
import type { PreapprovalWizardState } from "./preapprovalDraft";
import { isSupabaseConfigured, supabase } from "./supabase";

function supabaseRpcConfig(): { url: string; anonKey: string } | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

function validateEmail(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function isPartialPreapprovalEligible(wizard: PreapprovalWizardState): boolean {
  return (
    wizard.firstName.trim().length > 0 &&
    wizard.lastName.trim().length > 0 &&
    validateEmail(wizard.email)
  );
}

export function createMarketingLeadId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export type SyncPartialQueueResult = { ok: true } | { ok: false; error: string };

export type SyncPartialQueueSuccess = { ok: true; marketingLeadId: string };
export type SyncPartialQueueOutcome = SyncPartialQueueSuccess | { ok: false; error: string };

export async function syncPartialPreapprovalQueue(args: {
  marketingLeadId: string | null;
  wizardStep: number;
  wizard: PreapprovalWizardState;
  erasedFields: PreapprovalErasedFields;
}): Promise<SyncPartialQueueOutcome> {
  if (!isPartialPreapprovalEligible(args.wizard)) {
    return { ok: false, error: "Name and email are required." };
  }

  const leadId = args.marketingLeadId ?? createMarketingLeadId();
  const result = await upsertPartialPreapprovalQueue({
    marketingLeadId: leadId,
    wizardStep: args.wizardStep,
    wizard: args.wizard,
    erasedFields: args.erasedFields
  });

  if (!result.ok) return result;
  return { ok: true, marketingLeadId: leadId };
}

export function syncPartialPreapprovalQueueKeepalive(args: {
  marketingLeadId: string | null;
  wizardStep: number;
  wizard: PreapprovalWizardState;
  erasedFields: PreapprovalErasedFields;
}): SyncPartialQueueSuccess | null {
  if (!isPartialPreapprovalEligible(args.wizard)) return null;

  const leadId = args.marketingLeadId ?? createMarketingLeadId();
  return upsertPartialPreapprovalQueueKeepalive({
    marketingLeadId: leadId,
    wizardStep: args.wizardStep,
    wizard: args.wizard,
    erasedFields: args.erasedFields
  });
}

function partialQueueRpcBody(args: {
  marketingLeadId: string;
  wizardStep: number;
  wizard: PreapprovalWizardState;
  erasedFields: PreapprovalErasedFields;
}): string {
  return JSON.stringify({
    p_marketing_lead_id: args.marketingLeadId,
    p_wizard_step: args.wizardStep,
    p_wizard_snapshot: args.wizard,
    p_erased_fields: args.erasedFields
  });
}

function parsePartialQueueRpcResponse(payload: unknown): SyncPartialQueueResult {
  const row = payload as { ok?: boolean; error?: string } | null;
  if (!row || typeof row !== "object" || !row.ok) {
    return { ok: false, error: row?.error ?? "Could not save partial application." };
  }
  return { ok: true };
}

export async function upsertPartialPreapprovalQueue(args: {
  marketingLeadId: string;
  wizardStep: number;
  wizard: PreapprovalWizardState;
  erasedFields: PreapprovalErasedFields;
}): Promise<SyncPartialQueueResult> {
  const { data, error } = await supabase.rpc("upsert_preapproval_partial_queue", {
    p_marketing_lead_id: args.marketingLeadId,
    p_wizard_step: args.wizardStep,
    p_wizard_snapshot: args.wizard,
    p_erased_fields: args.erasedFields
  });

  if (error) {
    return { ok: false, error: error.message || "Could not save partial application." };
  }

  return parsePartialQueueRpcResponse(data);
}

/** Best-effort save when the tab closes or navigates away (normal fetch may be cancelled). */
export function upsertPartialPreapprovalQueueKeepalive(args: {
  marketingLeadId: string;
  wizardStep: number;
  wizard: PreapprovalWizardState;
  erasedFields: PreapprovalErasedFields;
}): SyncPartialQueueSuccess | null {
  if (!isSupabaseConfigured() || !isPartialPreapprovalEligible(args.wizard)) {
    return null;
  }

  const config = supabaseRpcConfig();
  if (!config) return null;

  const leadId = args.marketingLeadId;
  const body = partialQueueRpcBody({ ...args, marketingLeadId: leadId });

  try {
    void fetch(`${config.url}/rest/v1/rpc/upsert_preapproval_partial_queue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`
      },
      body,
      keepalive: true
    });
  } catch {
    return null;
  }

  return { ok: true, marketingLeadId: leadId };
}

export async function cancelPartialPreapprovalQueue(
  marketingLeadId: string | null | undefined
): Promise<void> {
  if (!marketingLeadId) return;
  await supabase.rpc("cancel_preapproval_partial_queue", {
    p_marketing_lead_id: marketingLeadId
  });
}
