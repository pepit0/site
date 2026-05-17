import { useCallback, useEffect, useState } from "react";
import {
  clearTawkPastePayload,
  readTawkPastePayload,
  TAWK_PASTE_PRIMED_EVENT,
  type TawkPastePayload
} from "../../lib/tawkOpeningMessage";

const HINT_AUTO_DISMISS_MS = 22_000;

export function TawkPasteHint() {
  const [payload, setPayload] = useState<TawkPastePayload | null>(null);

  const refresh = useCallback(() => {
    setPayload(readTawkPastePayload());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(TAWK_PASTE_PRIMED_EVENT, refresh);
    return () => window.removeEventListener(TAWK_PASTE_PRIMED_EVENT, refresh);
  }, [refresh]);

  useEffect(() => {
    if (!payload) return;
    const timer = window.setTimeout(() => {
      clearTawkPastePayload();
      setPayload(null);
    }, HINT_AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [payload]);

  const dismiss = () => {
    clearTawkPastePayload();
    setPayload(null);
  };

  const copyAgain = () => {
    if (!payload?.message || !navigator.clipboard?.writeText) return;
    void navigator.clipboard.writeText(payload.message);
  };

  if (!payload) return null;

  const stockLabel = payload.stockNumber ? `Stock #${payload.stockNumber}` : "your unit";

  return (
    <div className="site-tawkPasteHint" role="status" aria-live="polite">
      <p className="site-tawkPasteHintTitle">One quick step for {stockLabel}</p>
      <p className="site-tawkPasteHintBody">
        We copied a message into your clipboard. In the chat box, press <kbd>Ctrl</kbd>+<kbd>V</kbd> (or{" "}
        <kbd>⌘</kbd>+<kbd>V</kbd> on Mac) and send — that tells our assistant exactly which unit you picked.
      </p>
      <div className="site-tawkPasteHintActions">
        <button type="button" className="btn btn-primary site-tawkPasteHintBtn" onClick={copyAgain}>
          Copy again
        </button>
        <button type="button" className="site-chatTextBtn site-tawkPasteHintDismiss" onClick={dismiss}>
          Got it
        </button>
      </div>
    </div>
  );
}
