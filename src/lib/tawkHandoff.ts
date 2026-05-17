/** Open Tawk after site intake (name, phone, optional unit). */

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
};

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

function buildAttributes(params: TawkHandoffParams): Record<string, string> {
  const attrs: Record<string, string> = {
    name: params.name.trim(),
    phone: phoneForTawk(params.phone)
  };
  if (params.unitLabel?.trim()) {
    const label = params.unitLabel.trim();
    attrs["unit-interest"] = label;
    attrs.unitinterest = label;
  }
  if (params.unitId?.trim()) {
    const id = params.unitId.trim();
    attrs["unit-id"] = id;
    attrs.unitid = id;
  }
  if (params.unitHref?.trim()) {
    attrs["unit-url"] = params.unitHref.trim();
  }
  if (params.stockNumber?.trim()) {
    attrs["stock-number"] = params.stockNumber.trim();
  }
  return attrs;
}

function recordUnitInChat(params: TawkHandoffParams): void {
  const api = getApi();
  if (!api || !params.unitLabel?.trim()) return;

  const metadata: Record<string, string> = {
    unitInterest: params.unitLabel.trim(),
    unitId: params.unitId?.trim() ?? "",
    listingUrl: params.unitHref?.trim() ?? "",
    stockNumber: params.stockNumber?.trim() ?? ""
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

  await setAttributesAsync(buildAttributes(params));
  recordUnitInChat(params);
}

/** Re-apply pending unit context when the Tawk chat session starts. */
export function applyPendingTawkVisitorContext(): void {
  if (!pendingHandoff) return;
  void applyTawkVisitorContext(pendingHandoff);
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
 * Unit fields: unit-interest, unit-id, unit-url, stock-number (dashboard + AI base prompt).
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
