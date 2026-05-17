/** Meta Pixel base code lives in `index.html`; this module fires extra events from the SPA. */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export function isMetaPixelAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.fbq === "function";
}

export function trackMetaEvent(eventName: string, params?: Record<string, unknown>): void {
  if (!isMetaPixelAvailable()) return;
  if (params && Object.keys(params).length > 0) {
    window.fbq!("track", eventName, params);
  } else {
    window.fbq!("track", eventName);
  }
}

/** Meta standard event when pre-approval is submitted (completion screen). */
export function trackPreApprovalLead(): void {
  trackMetaEvent("Lead");
}
