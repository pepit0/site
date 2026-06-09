type SiteChatOpenHandler = () => void;

let openHandler: SiteChatOpenHandler | null = null;

export function registerSiteChatOpenHandler(handler: SiteChatOpenHandler | null): void {
  openHandler = handler;
}

/** Open the site chat intake panel, or Tawk directly when the panel is hidden after handoff. */
export function openSiteChat(): void {
  if (openHandler) {
    openHandler();
    return;
  }

  const api = typeof window !== "undefined" ? window.Tawk_API : undefined;
  api?.showWidget?.();
  window.setTimeout(() => {
    api?.maximize?.();
  }, 120);
}
