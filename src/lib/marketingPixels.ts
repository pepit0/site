import { trackGoogleAnalyticsPageView } from "./googleAnalytics";
import { trackMetaPageView, trackPreApprovalCompleteConversion as trackMetaPreApprovalComplete } from "./metaPixel";
import { trackPreApprovalTikTokLead, trackTikTokPageView } from "./tiktokPixel";

/** SPA route change — Meta PageView + TikTok page + GA4 page path. */
export function trackMarketingPageView(): void {
  trackMetaPageView();
  trackTikTokPageView();
  trackGoogleAnalyticsPageView();
}

/** Pre-approval thank-you page — Meta Lead + TikTok SubmitForm. */
export function trackPreApprovalCompleteConversion(): void {
  trackMetaPreApprovalComplete();
  trackPreApprovalTikTokLead();
}
