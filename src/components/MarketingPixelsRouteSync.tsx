import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { trackMarketingPageView } from "../lib/marketingPixels";

/**
 * Sends page views on client-side navigations (Meta + TikTok).
 * Skips the first render — index.html already fired the initial page load.
 */
export function MarketingPixelsRouteSync() {
  const { pathname, search } = useLocation();
  const skipNext = useRef(true);

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    trackMarketingPageView();
  }, [pathname, search]);

  return null;
}
