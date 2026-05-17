import { normalizeNanpTo10Digits } from "./phoneFormat";

const STORAGE_KEY = "tm_chat_visitor_contact";
/** Keep contact on this device ~1 year (same idea as Tawk remembering visitors). */
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

export type SavedChatVisitorContact = {
  name: string;
  phone: string;
  savedAt: number;
};

function readRaw(): SavedChatVisitorContact | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedChatVisitorContact;
    if (
      !parsed ||
      typeof parsed.name !== "string" ||
      typeof parsed.phone !== "string" ||
      typeof parsed.savedAt !== "number"
    ) {
      return null;
    }
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isValidChatVisitorContact(name: string, phone: string): boolean {
  return name.trim().length > 0 && phone.trim().length >= 7 && Boolean(normalizeNanpTo10Digits(phone));
}

/** Last name + phone from a completed intake (browser localStorage). */
export function readSavedChatVisitorContact(): SavedChatVisitorContact | null {
  const row = readRaw();
  if (!row || !isValidChatVisitorContact(row.name, row.phone)) return null;
  return { name: row.name.trim(), phone: row.phone.trim(), savedAt: row.savedAt };
}

export function saveChatVisitorContact(name: string, phone: string): void {
  if (typeof window === "undefined" || !isValidChatVisitorContact(name, phone)) return;
  try {
    const payload: SavedChatVisitorContact = {
      name: name.trim(),
      phone: phone.trim(),
      savedAt: Date.now()
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearSavedChatVisitorContact(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode */
  }
}

/** First token of saved name for “Welcome back” copy. */
export function savedContactFirstName(name: string): string {
  const first = name.trim().split(/\s+/)[0];
  return first || name.trim();
}
