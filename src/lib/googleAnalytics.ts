/** Google tag (gtag.js) base code is in `index.html` (load + first page view). */

export const GA_MEASUREMENT_ID = "G-SN0TCXVSPY";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function callGtag(...args: unknown[]): void {
  if (typeof window === "undefined") return;
  if (typeof window.gtag === "function") {
    window.gtag(...args);
    return;
  }
  window.dataLayer?.push(args);
}

/** SPA route change — update page path without reloading gtag.js. */
export function trackGoogleAnalyticsPageView(pagePath?: string): void {
  const path =
    pagePath ??
    (typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/");
  callGtag("config", GA_MEASUREMENT_ID, { page_path: path });
}
