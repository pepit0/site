import { useEffect, useRef } from "react";
import { getTawkEmbedPath } from "../../lib/tawkConfig";
import { applyPendingTawkVisitorContext } from "../../lib/tawkHandoff";
import { useTawkContext, type TawkAgentStatus } from "./tawkContext";

declare global {
  interface Window {
    Tawk_API?: {
      onLoad?: () => void;
      onStatusChange?: (status: string) => void;
      showWidget?: () => void;
      hideWidget?: () => void;
      maximize?: () => void;
      setAttributes?: (
        attributes: Record<string, string>,
        callback?: (error?: unknown) => void
      ) => void;
      addEvent?: (
        eventName: string,
        metadata: Record<string, string>,
        callback?: (error?: unknown) => void
      ) => void;
      addTags?: (tags: string[], callback?: (error?: unknown) => void) => void;
      onChatStarted?: () => void;
    };
    Tawk_LoadStart?: Date;
  }
}

function normalizeStatus(raw: string): TawkAgentStatus {
  const s = raw.toLowerCase();
  if (s === "online") return "online";
  if (s === "away") return "away";
  if (s === "offline") return "offline";
  return "unknown";
}

/** Hide the default bubble until site intake hands off (do not re-hide on every status tick). */
function hideTawkBubbleInitially() {
  window.Tawk_API?.hideWidget?.();
}

function markReadyIfLoaded(setTawkReady: (v: boolean) => void): boolean {
  if (typeof window.Tawk_API?.maximize === "function" || typeof window.Tawk_API?.showWidget === "function") {
    setTawkReady(true);
    return true;
  }
  return false;
}

export function TawkLoader() {
  const embedPath = getTawkEmbedPath();
  const { setStatus, setTawkReady } = useTawkContext();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!embedPath) {
      setTawkReady(false);
      setStatus("offline");
      return;
    }

    const onStatus = (raw: string) => {
      setStatus(normalizeStatus(raw));
    };

    window.Tawk_API = window.Tawk_API || {};
    const previousOnLoad = window.Tawk_API.onLoad;
    const previousOnChatStarted = window.Tawk_API.onChatStarted;
    window.Tawk_API.onLoad = () => {
      previousOnLoad?.();
      setTawkReady(true);
      hideTawkBubbleInitially();
    };
    window.Tawk_API.onChatStarted = () => {
      previousOnChatStarted?.();
      applyPendingTawkVisitorContext();
    };
    window.Tawk_API.onStatusChange = onStatus;

    if (markReadyIfLoaded(setTawkReady)) {
      hideTawkBubbleInitially();
    }

    const existing = document.querySelector(`script[data-tawk-embed="${embedPath}"]`);
    if (!existing) {
      window.Tawk_LoadStart = new Date();
      const s = document.createElement("script");
      s.async = true;
      s.src = `https://embed.tawk.to/${embedPath}`;
      s.charset = "UTF-8";
      s.setAttribute("crossorigin", "*");
      s.dataset.tawkEmbed = embedPath;
      const first = document.getElementsByTagName("script")[0];
      first?.parentNode?.insertBefore(s, first);
    }

    pollRef.current = window.setInterval(() => {
      if (markReadyIfLoaded(setTawkReady)) {
        if (pollRef.current != null) {
          window.clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    }, 200);

    const stopPoll = window.setTimeout(() => {
      if (pollRef.current != null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 20_000);

    return () => {
      if (pollRef.current != null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      window.clearTimeout(stopPoll);
    };
  }, [embedPath, setStatus, setTawkReady]);

  return null;
}
