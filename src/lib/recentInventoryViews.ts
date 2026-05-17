const STORAGE_KEY = "tm_recent_inventory_views";
const MAX_RECENT = 3;

type RecentView = {
  id: string;
  viewedAt: number;
};

function readAll(): RecentView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (v): v is RecentView =>
          v != null &&
          typeof v === "object" &&
          typeof (v as RecentView).id === "string" &&
          typeof (v as RecentView).viewedAt === "number"
      )
      .slice(0, MAX_RECENT * 2);
  } catch {
    return [];
  }
}

function writeAll(views: RecentView[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views.slice(0, MAX_RECENT)));
  } catch {
    /* quota / private mode */
  }
}

/** Record a unit detail view (newest first, max 3 unique ids). */
export function recordInventoryView(id: string): void {
  const trimmed = id.trim();
  if (!trimmed) return;
  const now = Date.now();
  const without = readAll().filter((v) => v.id !== trimmed);
  writeAll([{ id: trimmed, viewedAt: now }, ...without]);
}

/** Up to 3 recently viewed unit ids, newest first. */
export function getRecentInventoryViewIds(): string[] {
  return readAll()
    .sort((a, b) => b.viewedAt - a.viewedAt)
    .map((v) => v.id)
    .slice(0, MAX_RECENT);
}

/** Current listing first, then recent views (deduped), max 3. */
export function buildUnitPickIds(currentUnitId?: string | null): string[] {
  const current = currentUnitId?.trim() || null;
  const recent = getRecentInventoryViewIds();
  const ordered: string[] = [];
  const seen = new Set<string>();

  if (current) {
    ordered.push(current);
    seen.add(current);
  }
  for (const id of recent) {
    if (seen.has(id)) continue;
    ordered.push(id);
    seen.add(id);
    if (ordered.length >= MAX_RECENT) break;
  }
  return ordered.slice(0, MAX_RECENT);
}
