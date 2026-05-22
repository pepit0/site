const SESSION_KEY = "tm_preapproval_conversion_v1";
const LEAD_SENT_KEY = "tm_preapproval_lead_sent_v1";

/** Call once after a successful RPC submit, before navigating to the thank-you page. */
export function markPreApprovalConversion(): void {
  try {
    sessionStorage.removeItem(LEAD_SENT_KEY);
    sessionStorage.setItem(SESSION_KEY, "1");
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
  } catch {
    /* private mode / blocked storage */
  }
}

/** Thank-you page is only valid right after submit, or while Lead tracking finishes. */
export function canViewPreApprovalCompletePage(): boolean {
  return peekPreApprovalConversion() || hasPreApprovalLeadBeenTracked();
}
