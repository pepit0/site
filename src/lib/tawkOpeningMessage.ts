/** Visitor message copied before Tawk opens — AI Assist reads the chat thread, not sidebar fields. */

export const TAWK_PASTE_SESSION_KEY = "tm_tawk_paste_message";
export const TAWK_PASTE_PRIMED_EVENT = "tm-tawk-paste-primed";
const PASTE_TTL_MS = 5 * 60_000;

export type TawkPastePayload = {
  message: string;
  stockNumber?: string | null;
  at: number;
};

export function readTawkPastePayload(): TawkPastePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(TAWK_PASTE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TawkPastePayload;
    if (!parsed?.message?.trim() || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > PASTE_TTL_MS) {
      window.sessionStorage.removeItem(TAWK_PASTE_SESSION_KEY);
      return null;
    }
    return { ...parsed, message: parsed.message.trim() };
  } catch {
    return null;
  }
}

export function clearTawkPastePayload(): void {
  try {
    window.sessionStorage.removeItem(TAWK_PASTE_SESSION_KEY);
  } catch {
    /* private mode */
  }
}

/** Store + copy the opening line so the visitor can paste it into Tawk (only reliable AI context). */
export function primeTawkVisitorOpeningMessage(payload: TawkPastePayload): void {
  if (typeof window === "undefined" || !payload.message.trim()) return;
  const body: TawkPastePayload = {
    message: payload.message.trim(),
    stockNumber: payload.stockNumber?.trim() || null,
    at: Date.now()
  };
  try {
    window.sessionStorage.setItem(TAWK_PASTE_SESSION_KEY, JSON.stringify(body));
  } catch {
    /* private mode */
  }
  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(body.message).catch(() => {});
  }
  window.dispatchEvent(new CustomEvent(TAWK_PASTE_PRIMED_EVENT));
}
