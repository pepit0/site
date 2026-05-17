import { OfflineChatWidget } from "./OfflineChatWidget";
import { TawkLoader } from "./TawkLoader";
import { TawkPasteHint } from "./TawkPasteHint";
import { isTawkConfigured } from "../../lib/tawkConfig";

/** Live Tawk when agent is online; custom offline assistant otherwise. */
export function SiteChatMount() {
  return (
    <>
      {isTawkConfigured() ? <TawkLoader /> : null}
      {isTawkConfigured() ? <TawkPasteHint /> : null}
      <OfflineChatWidget />
    </>
  );
}
