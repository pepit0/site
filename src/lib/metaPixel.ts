/** Meta (Facebook) Pixel — set `VITE_META_PIXEL_ID` in env (Events Manager → Data sources → Pixel). */

declare global {
  interface Window {
    fbq?: FbqFn;
    _fbq?: FbqFn;
  }
}

type FbqFn = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  loaded?: boolean;
  version?: string;
  push?: FbqFn;
};

let initialized = false;

export function getMetaPixelId(): string | undefined {
  const id = import.meta.env.VITE_META_PIXEL_ID;
  if (typeof id !== "string") return undefined;
  const trimmed = id.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function isMetaPixelConfigured(): boolean {
  return getMetaPixelId() != null;
}

/** Load pixel script once per session (safe to call from layout). */
export function initMetaPixel(): void {
  const pixelId = getMetaPixelId();
  if (!pixelId || typeof window === "undefined" || initialized) return;
  if (window.fbq) {
    initialized = true;
    return;
  }

  const fbq: FbqFn = function (...args: unknown[]) {
    if (fbq.callMethod) {
      fbq.callMethod(...args);
    } else {
      fbq.queue?.push(args);
    }
  };
  if (!window._fbq) window._fbq = fbq;
  window.fbq = fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  const first = document.getElementsByTagName("script")[0];
  first?.parentNode?.insertBefore(script, first);

  window.fbq("init", pixelId);
  window.fbq("track", "PageView");
  initialized = true;
}

export function trackMetaEvent(eventName: string, params?: Record<string, unknown>): void {
  if (!getMetaPixelId() || typeof window === "undefined" || !window.fbq) return;
  if (params && Object.keys(params).length > 0) {
    window.fbq("track", eventName, params);
  } else {
    window.fbq("track", eventName);
  }
}

/** Meta standard event when pre-approval is submitted (completion screen). */
export function trackPreApprovalLead(): void {
  trackMetaEvent("Lead");
}
