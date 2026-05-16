export function stripPhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Format 10-digit NANP numbers as (403) 555-1234. Other lengths return trimmed input. */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone?.trim()) return "";
  let digits = stripPhoneDigits(phone);
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone.trim();
}
