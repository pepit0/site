import type { PreapprovalErasedFields } from "./preapprovalErasedFields";
import type { PreapprovalWizardState } from "./preapprovalDraft";
import { supabase } from "./supabase";

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

  const row = data as { ok?: boolean; error?: string } | null;
  if (!row || typeof row !== "object" || !row.ok) {
    return { ok: false, error: row?.error ?? "Could not save partial application." };
  }

  return { ok: true };
}

export async function cancelPartialPreapprovalQueue(
  marketingLeadId: string | null | undefined
): Promise<void> {
  if (!marketingLeadId) return;
  await supabase.rpc("cancel_preapproval_partial_queue", {
    p_marketing_lead_id: marketingLeadId
  });
}
