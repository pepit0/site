/** Optional public business facts for JSON-LD (must match Google Business Profile when set). */

export function optionalBusinessStreetAddress(): string | undefined {
  const v = (import.meta.env.VITE_PUBLIC_BUSINESS_STREET_ADDRESS as string | undefined)?.trim();
  return v || undefined;
}

export function optionalBusinessPostalCode(): string | undefined {
  const v = (import.meta.env.VITE_PUBLIC_BUSINESS_POSTAL_CODE as string | undefined)?.trim();
  return v || undefined;
}

/** Comma-separated profile URLs (Facebook, Maps, etc.). */
export function optionalSameAsUrls(): string[] {
  const raw = (import.meta.env.VITE_PUBLIC_BUSINESS_SAME_AS as string | undefined)?.trim() ?? "";
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
