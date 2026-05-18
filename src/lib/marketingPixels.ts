import { trackMetaPageView, trackPreApprovalCompleteConversion as trackMetaPreApprovalComplete } from "./metaPixel";
import { trackPreApprovalTikTokLead, trackTikTokPageView } from "./tiktokPixel";

/** SPA route change — Meta PageView + TikTok page. */
export function trackMarketingPageView(): void {
  trackMetaPageView();
  trackTikTokPageView();
}

/** Pre-approval thank-you page — Meta Lead + TikTok SubmitForm. */
export function trackPreApprovalCompleteConversion(): void {
  trackMetaPreApprovalComplete();
  trackPreApprovalTikTokLead();
}
