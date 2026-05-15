import { supabase } from "./supabase";
import type { VehicleCategory } from "../data/inventory";

export type SellRideSubmitPayload = {
  id: string;
  sellerFirstName: string;
  sellerLastName: string;
  sellerPhone: string;
  sellerEmail: string;
  year: number;
  make: string;
  model: string;
  odometerKm: number;
  category: VehicleCategory;
  sellerNotes: string;
  photoPaths: string[];
};

export type SellRideBeginDraftResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export type SellRideSubmitRpcResult = { ok: true } | { ok: false; error: string };

type BeginDraftRpcRow = {
  ok?: boolean;
  error?: string | null;
  id?: string | null;
};

type SubmitRpcRow = {
  ok?: boolean;
  error?: string | null;
};

export async function sellRideBeginDraft(): Promise<SellRideBeginDraftResult> {
  const { data, error } = await supabase.rpc("sell_ride_begin_draft");
  if (error) {
    return { ok: false, error: error.message || "Could not start submission." };
  }
  const row = data as BeginDraftRpcRow | null;
  if (!row || typeof row !== "object" || !row.ok || !row.id) {
    return { ok: false, error: row?.error ?? "Could not start submission." };
  }
  return { ok: true, id: row.id };
}

export async function sellRideSubmit(payload: SellRideSubmitPayload): Promise<SellRideSubmitRpcResult> {
  const { data, error } = await supabase.rpc("sell_ride_submit", {
    p_id: payload.id,
    p_seller_first_name: payload.sellerFirstName,
    p_seller_last_name: payload.sellerLastName,
    p_seller_phone: payload.sellerPhone,
    p_seller_email: payload.sellerEmail.length > 0 ? payload.sellerEmail : null,
    p_year: payload.year,
    p_make: payload.make,
    p_model: payload.model,
    p_odometer_km: payload.odometerKm,
    p_category: payload.category,
    p_seller_notes: payload.sellerNotes.length > 0 ? payload.sellerNotes : null,
    p_photo_paths: payload.photoPaths
  });

  if (error) {
    return { ok: false, error: error.message || "Submission failed." };
  }
  const row = data as SubmitRpcRow | null;
  if (!row || typeof row !== "object" || !row.ok) {
    return { ok: false, error: row?.error ?? "Submission failed." };
  }
  return { ok: true };
}
