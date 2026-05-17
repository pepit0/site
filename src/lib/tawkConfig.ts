/** Tawk embed path: `propertyId/widgetId` (Administration → Channels → Chat Widget). */
export function getTawkEmbedPath(): string | null {
  const raw = (import.meta.env.VITE_TAWK_PROPERTY_ID as string | undefined)?.trim() ?? "";
  if (raw.includes("/")) return raw;
  const widget = (import.meta.env.VITE_TAWK_WIDGET_ID as string | undefined)?.trim() ?? "";
  if (raw && widget) return `${raw}/${widget}`;
  return null;
}

export function isTawkConfigured(): boolean {
  return getTawkEmbedPath() != null;
}
