import { supabase } from "./supabase";

export type PublicPreapprovalPayload = {
  displayName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  street: string;
  line2: string;
  city: string;
  province: string;
  employer: string;
  grossMonthlyIncomeCad: number;
  vehicleInterest: string;
  consentContact: boolean;
  consentCredit: boolean;
};

export type SubmitPublicPreapprovalResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

type RpcRow = {
  ok?: boolean;
  error?: string;
  id?: string;
};

export async function submitPublicPreapprovalLead(
  payload: PublicPreapprovalPayload
): Promise<SubmitPublicPreapprovalResult> {
  const { data, error } = await supabase.rpc("submit_public_preapproval_lead", {
    p_display_name: payload.displayName,
    p_email: payload.email,
    p_phone: payload.phone,
    p_date_of_birth: payload.dateOfBirth,
    p_street: payload.street,
    p_line2: payload.line2.length > 0 ? payload.line2 : null,
    p_city: payload.city,
    p_province: payload.province,
    p_employer: payload.employer,
    p_gross_monthly_income_cad: payload.grossMonthlyIncomeCad,
    p_vehicle_interest: payload.vehicleInterest.length > 0 ? payload.vehicleInterest : null,
    p_consent_contact: payload.consentContact,
    p_consent_credit: payload.consentCredit
  });

  if (error) {
    return { ok: false, error: error.message || "Something went wrong. Please try again." };
  }

  const row = data as RpcRow | null;
  if (!row || typeof row !== "object") {
    return { ok: false, error: "Unexpected response from server." };
  }
  if (!row.ok) {
    return { ok: false, error: row.error ?? "Submission failed." };
  }
  if (!row.id) {
    return { ok: false, error: "Submission failed." };
  }
  return { ok: true, id: row.id };
}
