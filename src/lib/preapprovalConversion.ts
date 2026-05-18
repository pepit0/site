const SESSION_KEY = "tm_preapproval_conversion_v1";
const LEAD_SENT_KEY = "tm_preapproval_lead_sent_v1";
const CREDIT_BAND_KEY = "tm_preapproval_credit_band_v1";

const APPROVED_BANDS = new Set([
  "excellent_750_plus",
  "great_670_750",
  "good_620_670",
  "decent_550_619"
]);

export type PreapprovalOutcomeVariant = "approved" | "conditional" | "standard";

/** Call once after a successful RPC submit, before navigating to the thank-you page. */
export function markPreApprovalConversion(creditScoreBand: string): void {
  try {
    sessionStorage.removeItem(LEAD_SENT_KEY);
    sessionStorage.setItem(SESSION_KEY, "1");
    sessionStorage.setItem(CREDIT_BAND_KEY, creditScoreBand.trim());
  } catch {
    /* private mode / blocked storage */
  }
}

/** Pending conversion from a submit in this tab (not yet cleared). */
export function peekPreApprovalConversion(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function readPreApprovalOutcomeBand(): string | null {
  try {
    const band = sessionStorage.getItem(CREDIT_BAND_KEY);
    return band?.trim() ? band.trim() : null;
  } catch {
    return null;
  }
}

export function getPreApprovalOutcomeVariant(band: string | null): PreapprovalOutcomeVariant {
  if (!band) return "standard";
  if (band === "poor_300_549") return "conditional";
  if (band === "not_sure") return "standard";
  if (APPROVED_BANDS.has(band)) return "approved";
  return "standard";
}

/** Lead pixel already fired for the current thank-you visit (Strict Mode safe). */
export function hasPreApprovalLeadBeenTracked(): boolean {
  try {
    return sessionStorage.getItem(LEAD_SENT_KEY) === "1";
  } catch {
    return false;
  }
}

export function markPreApprovalLeadTracked(): void {
  try {
    sessionStorage.setItem(LEAD_SENT_KEY, "1");
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(CREDIT_BAND_KEY);
  } catch {
    /* private mode / blocked storage */
  }
}

/** Thank-you page is only valid right after submit, or while Lead tracking finishes. */
export function canViewPreApprovalCompletePage(): boolean {
  return peekPreApprovalConversion() || hasPreApprovalLeadBeenTracked();
}
