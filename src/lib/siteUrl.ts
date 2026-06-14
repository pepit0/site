/** Production site origin (no trailing slash). Override with VITE_PUBLIC_SITE_URL if needed. */
export const DEFAULT_PUBLIC_SITE_ORIGIN = "https://temptmotorsports.com";

/**
 * Canonical site origin for meta tags (no trailing slash).
 * Set VITE_PUBLIC_SITE_URL in .env.local or Vercel Production to match your live host.
 */
const raw =
  (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.trim() || DEFAULT_PUBLIC_SITE_ORIGIN;

export function getPublicSiteOrigin(): string {
  return raw.replace(/\/+$/, "");
}

export function hasPublicSiteOrigin(): boolean {
  return getPublicSiteOrigin().length > 0;
}

/** Absolute URL for a path starting with `/`. */
export function absoluteUrl(pathname: string): string {
  const origin = getPublicSiteOrigin();
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (!origin) return path;
  return `${origin}${path}`;
}

/** Default Open Graph image path under `public/` (built by `scripts/build-og-default.mjs`). */
export const DEFAULT_OG_IMAGE_PATH = "/og-default.png";

export const DEFAULT_OG_IMAGE_WIDTH = 1200;
export const DEFAULT_OG_IMAGE_HEIGHT = 630;
export const DEFAULT_OG_IMAGE_ALT = "Temptation Motorsports — powersports and motorsports financing";
