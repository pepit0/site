import { supabase } from "./supabase";
import type { VehicleCategory } from "../data/inventory";

export type SubmitChatLeadPayload = {
  displayName: string;
  phone: string;
  category: VehicleCategory | null;
  yearMin: number | null;
  yearMax: number | null;
  queryText: string;
  suggestedUnitIds: string[];
  pageUrl: string | null;
  selectedUnitId: string | null;
  selectedUnitLabel: string | null;
  visitorMessage: string;
  skippedUnitPick: boolean;
};

export type SubmitChatLeadResult = { ok: true; id: string } | { ok: false; error: string };

type RpcRow = { ok?: boolean; error?: string; id?: string };

export async function submitPublicChatLead(payload: SubmitChatLeadPayload): Promise<SubmitChatLeadResult> {
  const { data, error } = await supabase.rpc("submit_public_chat_lead", {
    p_display_name: payload.displayName.trim(),
    p_phone: payload.phone.trim(),
    p_category: payload.category,
    p_year_min: payload.yearMin,
    p_year_max: payload.yearMax,
    p_query_text: payload.queryText.trim() || null,
    p_suggested_unit_ids: payload.suggestedUnitIds,
    p_page_url: payload.pageUrl,
    p_selected_unit_id: payload.selectedUnitId,
    p_selected_unit_label: payload.selectedUnitLabel?.trim() || null,
    p_visitor_message: payload.visitorMessage.trim(),
    p_skipped_unit_pick: payload.skippedUnitPick
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  const row = data as RpcRow | null;
  if (!row || row.ok !== true || typeof row.id !== "string") {
    const err = row && typeof row.error === "string" ? row.error : "Could not save your request.";
    return { ok: false, error: err };
  }
  return { ok: true, id: row.id };
}
