/** TikTok Pixel base code is in `index.html` (load + first `ttq.page()`). */

export const TIKTOK_PIXEL_ID = "D857R6BC77UDUGTVJ450";

type TtqCommand = (...args: unknown[]) => void;

type Ttq = TtqCommand & {
  page?: () => void;
  track?: (event: string, params?: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    ttq?: Ttq;
  }
}

function callTtq(method: "page" | "track", ...args: unknown[]): void {
  if (typeof window === "undefined") return;
  const ttq = window.ttq;
  if (!ttq) return;
  if (method === "page" && typeof ttq.page === "function") {
    ttq.page();
    return;
  }
  if (method === "track" && typeof ttq.track === "function") {
    if (args.length >= 2 && args[1] && typeof args[1] === "object") {
      ttq.track(args[0] as string, args[1] as Record<string, unknown>);
    } else if (args.length >= 1) {
      ttq.track(args[0] as string);
    }
    return;
  }
  /* Stub queue before events.js loads */
  ttq(method, ...args);
}

export function trackTikTokPageView(): void {
  callTtq("page");
}

/**
 * TikTok standard event for lead / form completion (apply thank-you page).
 * Use SubmitForm in Events Manager if optimizing for that event name instead.
 */
export function trackPreApprovalTikTokLead(): void {
  callTtq("track", "SubmitForm", {
    contents: [{ content_name: "apply" }]
  });
}
