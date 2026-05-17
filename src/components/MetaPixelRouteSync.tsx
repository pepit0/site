import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { trackMetaPageView } from "../lib/metaPixel";

/**
 * Sends PageView on client-side navigations so Meta sees the real URL (SPA).
 * Skips the first render — index.html already fired the initial PageView.
 */
export function MetaPixelRouteSync() {
  const { pathname, search } = useLocation();
  const skipNext = useRef(true);

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    trackMetaPageView();
  }, [pathname, search]);

  return null;
}
