/** Open Tawk after site intake (name, phone, optional unit). */

import {
  buildTawkVisitorOpeningMessage,
  buildUnitDetailsForTawk,
  type ChatSuggestedUnit
} from "./chatSuggestInventory";
import { primeTawkVisitorOpeningMessage } from "./tawkOpeningMessage";
import { normalizeNanpTo10Digits } from "./phoneFormat";

export type TawkHandoffParams = {
  /** Delay showing Tawk until intake panel fade starts (ms). */
  revealDelayMs?: number;
  name: string;
  phone: string;
  unitLabel?: string | null;
  unitId?: string | null;
  unitHref?: string | null;
  stockNumber?: string | null;
  /** Full unit facts string for agents (sidebar). */
  unitDetails?: string | null;
  /** Copied for the visitor to paste into Tawk — AI reads the chat thread, not sidebar fields. */
  openingVisitorMessage?: string | null;
};

const TAWK_UNIT_SESSION_KEY = "tm_tawk_selected_unit";

/** Kept until chat starts so onChatStarted can re-apply unit context for AI Assist. */
let pendingHandoff: TawkHandoffParams | null = null;

export function peekPendingTawkHandoff(): TawkHandoffParams | null {
  return pendingHandoff;
}

function getApi(): Window["Tawk_API"] | undefined {
  return typeof window !== "undefined" ? window.Tawk_API : undefined;
}

function apiCanOpen(): boolean {
  const api = getApi();
  return Boolean(api && (api.maximize || api.showWidget));
}

/** Tawk prefers E.164 for phone on the visitor profile. */
function phoneForTawk(raw: string): string {
  const trimmed = raw.trim();
  const nanp = normalizeNanpTo10Digits(trimmed);
  if (nanp) return `+1${nanp}`;
  return trimmed;
}

/** Short unit hint on the display name (for human agents in the sidebar). */
function displayNameForTawk(params: TawkHandoffParams): string {
  const base = params.name.trim();
  const label = params.unitLabel?.trim();
  if (!label) return base;
  const stock = params.stockNumber?.trim();
  const short = stock ? `Stock #${stock}` : label.length > 48 ? `${label.slice(0, 45)}…` : label;
  return `${base} · ${short}`;
}

function unitContextSentence(params: TawkHandoffParams): string | null {
  const label = params.unitLabel?.trim();
  if (!label) return null;
  return `Website intake: visitor selected unit — ${label}.`;
}

function persistUnitSession(params: TawkHandoffParams): void {
  if (typeof window === "undefined" || !params.unitLabel?.trim()) return;
  try {
    window.sessionStorage.setItem(
      TAWK_UNIT_SESSION_KEY,
      JSON.stringify({
        label: params.unitLabel.trim(),
        details: params.unitDetails?.trim() ?? null,
        id: params.unitId?.trim() ?? null,
        stock: params.stockNumber?.trim() ?? null,
        href: params.unitHref?.trim() ?? null,
        savedAt: Date.now()
      })
    );
  } catch {
    /* private mode */
  }
}

function buildAttributes(params: TawkHandoffParams): Record<string, string> {
  const attrs: Record<string, string> = {
    name: displayNameForTawk(params),
    phone: phoneForTawk(params.phone)
  };

  const sentence = unitContextSentence(params);
  if (sentence) {
    attrs["selected-unit"] = sentence;
  }

  if (params.unitLabel?.trim()) {
    const label = params.unitLabel.trim();
    attrs["unit-interest"] = label;
    attrs.unitinterest = label;
  }
  if (params.unitDetails?.trim()) {
    const details = params.unitDetails.trim();
    attrs["unit-details"] = details;
    attrs.unitdetails = details;
  }
  if (params.unitId?.trim()) {
    const id = params.unitId.trim();
    attrs["unit-id"] = id;
    attrs.unitid = id;
  }
  if (params.unitHref?.trim()) {
    const url = params.unitHref.trim();
    attrs["unit-url"] = url;
    attrs.listingurl = url;
  }
  if (params.stockNumber?.trim()) {
    const stock = params.stockNumber.trim();
    attrs["stock-number"] = stock;
    attrs.stocknumber = stock;
  }
  return attrs;
}

/** Build handoff params from a picked inventory unit card. */
export function tawkHandoffFromUnit(
  base: Pick<TawkHandoffParams, "name" | "phone" | "revealDelayMs">,
  unit: ChatSuggestedUnit | null
): TawkHandoffParams {
  if (!unit) {
    return {
      ...base,
      unitLabel: null,
      unitId: null,
      unitHref: null,
      stockNumber: null,
      unitDetails: null,
      openingVisitorMessage: null
    };
  }
  const label = `${unit.year} ${unit.title} — Stock #${unit.stock_number}`;
  return {
    ...base,
    unitLabel: label,
    unitId: unit.id,
    unitHref: unit.href,
    stockNumber: unit.stock_number,
    unitDetails: buildUnitDetailsForTawk(unit),
    openingVisitorMessage: buildTawkVisitorOpeningMessage(unit)
  };
}

function recordUnitInChat(params: TawkHandoffParams): void {
  const api = getApi();
  if (!api || !params.unitLabel?.trim()) return;

  const metadata: Record<string, string> = {
    unitInterest: params.unitLabel.trim(),
    unitDetails: params.unitDetails?.trim() ?? params.unitLabel.trim(),
    unitId: params.unitId?.trim() ?? "",
    listingUrl: params.unitHref?.trim() ?? "",
    stockNumber: params.stockNumber?.trim() ?? "",
    openingMessage: params.openingVisitorMessage?.trim() ?? ""
  };

  api.addEvent?.("website-unit-selected", metadata, () => {});

  const tags: string[] = [];
  if (params.stockNumber?.trim()) {
    tags.push(`stock-${params.stockNumber.trim().replace(/\s+/g, "-")}`);
  }
  if (tags.length > 0) {
    api.addTags?.(tags, () => {});
  }
}

function setAttributesAsync(attributes: Record<string, string>): Promise<boolean> {
  const api = getApi();
  const setAttributes = api?.setAttributes;
  if (!setAttributes) return Promise.resolve(false);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    window.setTimeout(() => finish(true), 5_000);

    try {
      setAttributes(attributes, (error?: unknown) => {
        finish(!error);
      });
    } catch {
      finish(false);
    }
  });
}

/** Apply name, phone, and unit fields (call again on onChatStarted if needed). */
export async function applyTawkVisitorContext(params: TawkHandoffParams): Promise<void> {
  const api = getApi();
  if (!api) return;

  persistUnitSession(params);
  await setAttributesAsync(buildAttributes(params));
  recordUnitInChat(params);

  const opening = params.openingVisitorMessage?.trim();
  if (opening) {
    primeTawkVisitorOpeningMessage({
      message: opening,
      stockNumber: params.stockNumber?.trim() ?? null,
      at: Date.now()
    });
  }
}

/** Re-apply pending unit context when the Tawk chat session starts. */
export function applyPendingTawkVisitorContext(): void {
  if (!pendingHandoff) return;
  void applyTawkVisitorContext(pendingHandoff);
  // Second pass after the session UI mounts (attributes sometimes apply only after start).
  window.setTimeout(() => {
    if (pendingHandoff) void applyTawkVisitorContext(pendingHandoff);
  }, 600);
}

/** Wait until Tawk embed API is callable (after onLoad). */
export function waitForTawkApi(timeoutMs = 15_000): Promise<boolean> {
  if (apiCanOpen()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (apiCanOpen()) {
        resolve(true);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(false);
        return;
      }
      window.setTimeout(tick, 100);
    };
    tick();
  });
}

function revealTawkWidget(delayMs = 0): void {
  const api = getApi();
  if (!api) return;
  const open = () => {
    api.showWidget?.();
    window.setTimeout(() => {
      api.maximize?.();
    }, 120);
  };
  if (delayMs > 0) {
    window.setTimeout(open, delayMs);
    return;
  }
  open();
}

/**
 * Pass visitor + unit context into Tawk, then open the widget.
 * Unit fields: unit-interest, unit-id, unit-url, stock-number, selected-unit, name suffix.
 */
export async function openTawkHandoff(params: TawkHandoffParams): Promise<boolean> {
  pendingHandoff = params;

  const ready = await waitForTawkApi();
  const api = getApi();
  if (!ready || !api) return false;

  await applyTawkVisitorContext(params);

  revealTawkWidget(params.revealDelayMs ?? 0);
  return true;
}
