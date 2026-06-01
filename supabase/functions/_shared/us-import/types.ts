export const VEHICLE_CATEGORIES = [
  "Motorcycle",
  "ATV",
  "Snowmobile",
  "Side by side",
  "Watercraft",
  "Trailer"
] as const;

export type VehicleCategory = (typeof VEHICLE_CATEGORIES)[number];

export type UsImportSourceConfig = {
  id: string;
  adapter: "dealer_spike" | "woocommerce" | "listivo" | "inventory_presser" | "dx1";
  baseUrl: string;
  priority: number;
  label?: string;
  /** When set, this source is tried first for these categories (still available for others later). */
  categories?: VehicleCategory[];
  /** Dealer Spike list path segment (default `--Inventory`). */
  listPath?: string;
  /** Dealer Spike pre-owned list condition (e.g. `pre-owned`). */
  listCondition?: string;
  /** Extra Dealer Spike list query params (repeat keys via string arrays, e.g. multiple `location`). */
  listExtraParams?: Record<string, string | string[]>;
  /** Drop the first source photo (dealer logo / placeholder on some feeds). */
  skipFirstPhoto?: boolean;
  /** DX1 showroom list page used to read Algolia credentials. */
  dx1ListPath?: string;
  /** DX1 Algolia filter (default `Condition:Used`). */
  dx1Filter?: string;
};

export type UsImportCandidate = {
  sourceProductId: string;
  stockNumber: string;
  year: number;
  make: string;
  model: string;
  odometerKm: number | null;
  category: VehicleCategory;
  photoUrls: string[];
  permalink: string | null;
  title: string | null;
  sourceNotes: string | null;
  importSource: string;
};

export type SearchOpts = {
  category: VehicleCategory;
  usedOnly: boolean;
  /** Stop after yielding this many category matches. */
  maxYields: number;
  /** Stop after this many detail JSON fetches (quality/category misses still count). */
  maxScans: number;
  seenSourceIds: Set<string>;
  listPath?: string;
  listConditions?: string[];
  listExtraParams?: Record<string, string | string[]>;
  skipFirstPhoto?: boolean;
};

export function applySkipFirstPhoto(urls: string[], skipFirst: boolean | undefined): string[] {
  if (!skipFirst || urls.length === 0) return urls;
  return urls.slice(1);
}

export { US_IMPORT_SOURCES } from "./registry.ts";

export function importSourceKey(source: UsImportSourceConfig): string {
  return `us_${source.adapter}_${source.id}`;
}

/** Prefer sources tagged for this category, then the rest (stable priority sort within each group). */
export function sourcesForCategory(
  sources: UsImportSourceConfig[],
  category: VehicleCategory
): UsImportSourceConfig[] {
  const preferred: UsImportSourceConfig[] = [];
  const general: UsImportSourceConfig[] = [];
  const deferred: UsImportSourceConfig[] = [];

  for (const source of sources) {
    const tags = source.categories;
    if (!tags?.length) {
      general.push(source);
    } else if (tags.includes(category)) {
      preferred.push(source);
    } else {
      deferred.push(source);
    }
  }

  const byPriority = (a: UsImportSourceConfig, b: UsImportSourceConfig) => a.priority - b.priority;
  return [...preferred.sort(byPriority), ...general.sort(byPriority), ...deferred.sort(byPriority)];
}

export function normalizeStock(raw: string): string {
  return raw.trim().toUpperCase();
}

/** Strip ® / ™ (and HTML entities) from dealer make/model labels; collapse whitespace. */
export function sanitizeImportLabel(value: string | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/\u00AE/g, "")
    .replace(/\u2122/g, "")
    .replace(/&reg;/gi, "")
    .replace(/&trade;/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function applyListExtraParams(
  params: URLSearchParams,
  extra?: Record<string, string | string[]>
): void {
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (!key || value == null) continue;
    if (Array.isArray(value)) {
      for (const v of value) {
        if (v) params.append(key, v);
      }
    } else if (value) {
      params.set(key, value);
    }
  }
}

export function milesToKm(miles: number): number {
  return Math.round(miles * 1.60934);
}

export function parseMiles(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).replace(/,/g, "");
  const m = s.match(/([\d.]+)\s*mi/i);
  if (m?.[1]) {
    const n = Number.parseFloat(m[1]);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  }
  const digits = s.replace(/[^\d.]/g, "");
  if (!digits) return null;
  const n = Number.parseFloat(digits);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

export function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const n = u.trim();
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export function absUrl(base: string, href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  const b = base.replace(/\/+$/, "");
  return href.startsWith("/") ? `${b}${href}` : `${b}/${href}`;
}

export function passesQualityFilter(c: UsImportCandidate, minPhotos = 5): boolean {
  if (!c.make?.trim() || !c.model?.trim()) return false;
  if (!Number.isFinite(c.year) || c.year < 1900 || c.year > 2100) return false;
  if (c.photoUrls.length < minPhotos) return false;
  return true;
}

export function buildSourceNotes(parts: Array<string | null | undefined>): string | null {
  const lines = parts.map((p) => p?.trim()).filter((p): p is string => Boolean(p));
  return lines.length ? lines.join("\n") : null;
}
