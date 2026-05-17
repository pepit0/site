/**
 * Meta Pixel base code is in `index.html` (init + first PageView).
 * SPA routes fire extra events here — mirrors Meta’s `fbq('track', 'Lead')` on the thank-you page.
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export function isMetaPixelAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.fbq === "function";
}

/** Queue a pixel call (stub in index.html buffers until fbevents.js loads). */
function callFbq(...args: unknown[]): void {
  if (typeof window === "undefined") return;
  if (typeof window.fbq === "function") {
    window.fbq(...args);
  }
}

export function trackMetaPageView(): void {
  callFbq("track", "PageView");
}

export function trackMetaEvent(eventName: string, params?: Record<string, unknown>): void {
  if (params && Object.keys(params).length > 0) {
    callFbq("track", eventName, params);
  } else {
    callFbq("track", eventName);
  }
}

/**
 * Meta standard Lead event — same as pasting on the form completion page:
 * `fbq('track', 'Lead');`
 */
export function trackPreApprovalLead(): void {
  trackMetaEvent("Lead");
}

/**
 * Lead on the thank-you page. PageView for this URL is sent by {@link MetaPixelRouteSync}
 * on client navigation (or by index.html on a full reload).
 */
export function trackPreApprovalCompleteConversion(): void {
  trackPreApprovalLead();
}
