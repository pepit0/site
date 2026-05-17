/** Marker in admin_notes when MSF sync auto-marks a unit Sold (edge function + scripts). */
export const MSF_SOLD_SYNC_MARKER = "No longer listed on motorsportsfinancing.ca";

export function msfSoldSyncNoteLine(isoDate = new Date().toISOString().slice(0, 10)): string {
  return `[MSF sync ${isoDate}] ${MSF_SOLD_SYNC_MARKER} — marked Sold on this catalog automatically.`;
}

export function appendInventoryAdminNote(existing: string | null | undefined, line: string): string {
  const prev = existing?.trim() ?? "";
  if (prev.includes(MSF_SOLD_SYNC_MARKER) && line.includes(MSF_SOLD_SYNC_MARKER)) return prev;
  return prev ? `${prev}\n\n${line}` : line;
}
