/** SERP title length (keep in sync with scripts/lib/seo-title.mjs). */

export const SEO_BRAND_SUFFIX = " | Temptation Motorsports";
export const SERP_TITLE_MAX_CHARS = 60;

/** Base title room before the brand suffix is appended. */
export const SEO_BASE_TITLE_MAX_CHARS = SERP_TITLE_MAX_CHARS - SEO_BRAND_SUFFIX.length;

export function formatSeoDocumentTitle(baseTitle: string): string {
  if (baseTitle.includes("Temptation Motorsports")) return baseTitle;

  const full = `${baseTitle}${SEO_BRAND_SUFFIX}`;
  if (full.length <= SERP_TITLE_MAX_CHARS) return full;

  const room = SEO_BASE_TITLE_MAX_CHARS;
  if (room < 8) return baseTitle.slice(0, SERP_TITLE_MAX_CHARS);
  return `${baseTitle.slice(0, room - 1).trimEnd()}…${SEO_BRAND_SUFFIX}`;
}
