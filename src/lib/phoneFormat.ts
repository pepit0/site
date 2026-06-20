/** Strip to digits only. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Normalize NANP input to exactly 10 digits, or null if empty.
 * Accepts 10 digits or 11 starting with 1.
 */
export function normalizeNanpTo10Digits(raw: string): string | null {
  const d = digitsOnly(raw.trim());
  if (d.length === 0) {
    return null;
  }
  let n = d;
  if (n.length === 11 && n.startsWith("1")) {
    n = n.slice(1);
  }
  if (n.length !== 10) {
    return null;
  }
  return n;
}

/** For API writes: valid 10-digit -> digits; blank -> null; invalid -> error. */
export function normalizePhoneForStorage(raw: string): { value: string | null; error: string | null } {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { value: null, error: null };
  }
  const n = normalizeNanpTo10Digits(trimmed);
  if (!n) {
    return { value: null, error: "Enter a valid 10-digit phone number (US/Canada)." };
  }
  return { value: n, error: null };
}
