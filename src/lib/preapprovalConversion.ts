const SESSION_KEY = "tm_preapproval_conversion_v1";

/** Call once after a successful RPC submit, before navigating to the thank-you page. */
export function markPreApprovalConversion(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* private mode / blocked storage */
  }
}

/** True only immediately after a successful submit; clears the flag. */
export function consumePreApprovalConversion(): boolean {
  try {
    const ok = sessionStorage.getItem(SESSION_KEY) === "1";
    if (ok) sessionStorage.removeItem(SESSION_KEY);
    return ok;
  } catch {
    return false;
  }
}
