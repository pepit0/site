/** Open Tawk after site intake (name, phone, optional unit). */

export type TawkHandoffParams = {
  /** Delay showing Tawk until intake panel fade starts (ms). */
  revealDelayMs?: number;
  name: string;
  phone: string;
  unitLabel?: string | null;
  unitId?: string | null;
};

function getApi(): Window["Tawk_API"] | undefined {
  return typeof window !== "undefined" ? window.Tawk_API : undefined;
}

function apiCanOpen(): boolean {
  const api = getApi();
  return Boolean(api && (api.maximize || api.showWidget));
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
 * Pass visitor context into Tawk and open the widget.
 * Custom keys (unit-interest, unit-id) appear on the visitor profile in the dashboard.
 */
export async function openTawkHandoff(params: TawkHandoffParams): Promise<boolean> {
  const ready = await waitForTawkApi();
  const api = getApi();
  if (!ready || !api) return false;

  const attributes: Record<string, string> = {
    name: params.name.trim(),
    phone: params.phone.trim()
  };
  if (params.unitLabel?.trim()) {
    attributes["unit-interest"] = params.unitLabel.trim();
  }
  if (params.unitId?.trim()) {
    attributes["unit-id"] = params.unitId.trim();
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (ok) {
        revealTawkWidget(params.revealDelayMs ?? 0);
      }
      resolve(ok);
    };

    // Never hang if setAttributes omits the callback.
    window.setTimeout(() => finish(true), 2_500);

    if (api.setAttributes) {
      try {
        api.setAttributes(attributes, () => {
          finish(true);
        });
      } catch {
        finish(true);
      }
      return;
    }

    finish(true);
  });
}
