import { supabase } from "./supabase";

export type PublicPreapprovalPayload = {
  marketingLeadId?: string | null;
  displayName: string;
  email: string | null;
  phone: string;
  dateOfBirth: string;
  street: string;
  line2: string;
  city: string;
  province: string;
  employer: string;
  jobTitle: string | null;
  grossMonthlyIncomeCad: number;
  otherMonthlyIncomeCad: number | null;
  otherIncomeDescription: string | null;
  vehicleInterest: string;
  monthlyBudgetCad: number;
  hasTrade: boolean;
  tradeYear: string | null;
  tradeMake: string | null;
  tradeModel: string | null;
  tradeKms: string | null;
  employmentStatus: string;
  employmentOtherDescription: string | null;
  employmentType: string | null;
  incomeTenure: string;
  creditScoreBand: string;
  addressTenure: string;
  sin: string | null;
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

function nullIfEmpty(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  return t.length > 0 ? t : null;
}

export async function submitPublicPreapprovalLead(
  payload: PublicPreapprovalPayload
): Promise<SubmitPublicPreapprovalResult> {
  const { data, error } = await supabase.rpc("submit_public_preapproval_lead", {
    p_display_name: payload.displayName,
    p_email: nullIfEmpty(payload.email ?? ""),
    p_phone: payload.phone,
    p_date_of_birth: payload.dateOfBirth,
    p_street: payload.street,
    p_line2: payload.line2.length > 0 ? payload.line2 : null,
    p_city: payload.city,
    p_province: payload.province,
    p_employer: payload.employer,
    p_job_title: nullIfEmpty(payload.jobTitle ?? ""),
    p_gross_monthly_income_cad: payload.grossMonthlyIncomeCad,
    p_other_monthly_income_cad:
      payload.otherMonthlyIncomeCad != null && Number.isFinite(payload.otherMonthlyIncomeCad)
        ? payload.otherMonthlyIncomeCad
        : null,
    p_other_income_description: nullIfEmpty(payload.otherIncomeDescription ?? ""),
    p_vehicle_interest: payload.vehicleInterest.length > 0 ? payload.vehicleInterest : null,
    p_monthly_budget_cad: payload.monthlyBudgetCad,
    p_has_trade: payload.hasTrade,
    p_trade_year: nullIfEmpty(payload.tradeYear ?? ""),
    p_trade_make: nullIfEmpty(payload.tradeMake ?? ""),
    p_trade_model: nullIfEmpty(payload.tradeModel ?? ""),
    p_trade_kms: nullIfEmpty(payload.tradeKms ?? ""),
    p_employment_status: payload.employmentStatus,
    p_employment_other_description: nullIfEmpty(payload.employmentOtherDescription ?? ""),
    p_employment_type: nullIfEmpty(payload.employmentType ?? ""),
    p_income_tenure: payload.incomeTenure,
    p_credit_score_band: payload.creditScoreBand,
    p_address_tenure: payload.addressTenure,
    p_sin: nullIfEmpty(payload.sin ?? ""),
    p_consent_contact: payload.consentContact,
    p_consent_credit: payload.consentCredit,
    p_marketing_lead_id: payload.marketingLeadId ?? null
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
