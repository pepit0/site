import type { SearchOpts, UsImportCandidate, VehicleCategory } from "./types.ts";
import { applyListExtraParams, applySkipFirstPhoto, sanitizeImportLabel } from "./types.ts";

export function mapDealerSpikeCategory(vtype: string | null, subcategory: string | null): VehicleCategory | null {
  const t = (vtype ?? "").toLowerCase();
  const s = (subcategory ?? "").toLowerCase();
  if (t.includes("snowmobile") || s.includes("snowmobile")) return "Snowmobile";
  if (
    t.includes("boat") ||
    t.includes("personal watercraft") ||
    t.includes("watercraft") ||
    t.includes("pwc") ||
    t.includes("jet ski") ||
    t.includes("jetski") ||
    s.includes("wakeboard") ||
    s.includes("wakesurf") ||
    s.includes("bowrider") ||
    s.includes("pontoon")
  ) {
    return "Watercraft";
  }
  if (t.includes("motorcycle") || t.includes("scooter")) return "Motorcycle";
  if (s.includes("sport") || s.includes("dirt") || s.includes("dual") || s.includes("adventure") || s.includes("supermoto")) {
    return "Motorcycle";
  }
  if (t.includes("atv")) return "ATV";
  if (t.includes("utility vehicle") || t.includes("side-by-side") || t.includes("side by side") || t === "sxs") {
    return "Side by side";
  }
  if (t.includes("trailer") || t.includes("rv") || t.includes("travel")) return "Trailer";
  return null;
}

export function dealerSpikeCategoryQuery(category: VehicleCategory): { vtype?: string; subcategory?: string } {
  switch (category) {
    case "ATV":
      return { vtype: "ATV" };
    case "Side by side":
      return { vtype: "Utility Vehicle" };
    case "Motorcycle":
      return { vtype: "Motorcycle" };
    case "Snowmobile":
      return { vtype: "Snowmobile" };
    case "Watercraft":
      return { vtype: "Personal Watercraft" };
    case "Trailer":
      return { vtype: "Trailer" };
    default:
      return {};
  }
}

const OID_RE = /oid(?:=|%3D|%26#x3D;|&#x3D;)(\d+)/gi;

/** RideNow list pages use Pre-Owned; detail JSON reports USED / CERTIFIED. */
function isUsedInventoryCondition(raw: unknown): boolean {
  const c = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/-/g, " ");
  return c === "USED" || c === "CERTIFIED" || c === "PRE OWNED" || c === "PREOWNED";
}

export function extractOidsFromHtml(html: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of html.matchAll(OID_RE)) {
    const id = m[1];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { Accept: "text/html,application/json,*/*", "User-Agent": "TemptationMotorsportsImport/1.0" },
    redirect: "follow"
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json,*/*", "User-Agent": "TemptationMotorsportsImport/1.0" },
    redirect: "follow"
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return (await res.json()) as T;
}

const DETAIL_CONCURRENCY = 12;
const LIST_PAGE_SIZE = 50;
/** Dealer Spike list `condition` values that return pre-owned inventory (not `USED`, which is often empty). */
const USED_LIST_CONDITIONS = ["Pre-Owned", "Used", "USED"];

type DsImage = { URL?: string; Extra?: string; Large?: string; Medium?: string };
type DsDetail = {
  id?: number;
  condition?: string;
  stock_number?: string;
  year?: number;
  make?: string;
  model?: string;
  category?: string;
  subcategory?: string;
  miles?: string;
  miles_normalized?: number;
  location?: string;
  formattedPrice?: string;
  price?: number;
  title?: string;
  detailpage?: string;
  aImages?: DsImage[];
  assetimagecount?: number;
};

async function fetchDetailRow(base: string, oid: string): Promise<DsDetail | null> {
  try {
    const detail = await fetchJson<DsDetail[]>(`${base}/--xInventoryDetail?oid=${oid}&format=json`);
    const row = Array.isArray(detail) ? detail[0] : null;
    return row ?? null;
  } catch {
    return null;
  }
}

async function fetchDetailRows(base: string, oids: string[]): Promise<Array<{ oid: string; row: DsDetail | null }>> {
  const out: Array<{ oid: string; row: DsDetail | null }> = new Array(oids.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(DETAIL_CONCURRENCY, oids.length) }, async () => {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= oids.length) break;
      const oid = oids[i]!;
      out[i] = { oid, row: await fetchDetailRow(base, oid) };
    }
  });
  await Promise.all(workers);
  return out;
}

function photosFromDetail(d: DsDetail, skipFirstPhoto?: boolean): string[] {
  const urls: string[] = [];
  if (Array.isArray(d.aImages)) {
    for (const im of d.aImages) {
      const u = im.Extra || im.Large || im.URL || im.Medium;
      if (typeof u === "string" && u.trim()) urls.push(u.startsWith("//") ? `https:${u}` : u);
    }
  }
  return applySkipFirstPhoto(urls, skipFirstPhoto);
}

function mapDetailToCandidate(
  d: DsDetail,
  baseUrl: string,
  importSource: string,
  skipFirstPhoto?: boolean
): UsImportCandidate | null {
  const id = d.id != null ? String(d.id) : null;
  if (!id) return null;
  const category = mapDealerSpikeCategory(d.category ?? null, d.subcategory ?? null);
  if (!category) return null;
  const stock = (d.stock_number ?? "").trim() || `US-${id}`;
  const year = typeof d.year === "number" ? d.year : null;
  const make = sanitizeImportLabel(d.make) || null;
  const model = sanitizeImportLabel(d.model) || null;
  if (!year || !make || !model) return null;

  let miles: number | null = null;
  if (typeof d.miles_normalized === "number" && Number.isFinite(d.miles_normalized)) {
    miles = Math.round(d.miles_normalized);
  } else if (d.miles) {
    const m = String(d.miles).match(/([\d,]+)/);
    if (m?.[1]) {
      const n = Number.parseInt(m[1].replace(/,/g, ""), 10);
      if (Number.isFinite(n)) miles = n;
    }
  }

  const photoUrls = photosFromDetail(d, skipFirstPhoto);
  const permalink = d.detailpage
    ? d.detailpage.startsWith("http")
      ? d.detailpage
      : `${baseUrl.replace(/\/+$/, "")}${d.detailpage.startsWith("/") ? d.detailpage : `/${d.detailpage}`}`
    : `${baseUrl}/--xInventoryDetail?oid=${id}`;

  const priceNote =
    d.formattedPrice?.trim() ||
    (typeof d.price === "number" && d.price > 0 ? `$${d.price.toLocaleString("en-US")}` : null);

  const sourceNotes = [
    d.location ? `US source: ${d.location}` : null,
    priceNote ? `Listed price: USD ${priceNote.replace(/^\$/, "")}` : null,
    d.condition ? `Condition: ${d.condition}` : null,
    permalink ? `Source: ${permalink}` : null
  ]
    .filter(Boolean)
    .join("\n");

  return {
    sourceProductId: id,
    stockNumber: stock,
    year,
    make,
    model,
    odometerKm: miles != null ? Math.round(miles * 1.60934) : null,
    category,
    photoUrls,
    permalink,
    title: sanitizeImportLabel(d.title) || `${year} ${make} ${model}`.trim(),
    sourceNotes: sourceNotes || null,
    importSource
  };
}

export async function* searchDealerSpike(
  baseUrl: string,
  importSource: string,
  opts: SearchOpts
): AsyncGenerator<UsImportCandidate> {
  let yielded = 0;
  for await (const candidate of scanDealerSpikeUsedCatalog(baseUrl, importSource, opts)) {
    if (yielded >= opts.maxYields || opts.seenSourceIds.size > opts.maxScans) return;
    if (candidate.category !== opts.category) continue;
    yielded += 1;
    yield candidate;
  }
}

/** Scan all used units from a Dealer Spike feed (any category). */
export async function* scanDealerSpikeUsedCatalog(
  baseUrl: string,
  importSource: string,
  opts: Pick<
    SearchOpts,
    "usedOnly" | "maxScans" | "seenSourceIds" | "listPath" | "listConditions" | "listExtraParams" | "skipFirstPhoto"
  >
): AsyncGenerator<UsImportCandidate> {
  const base = baseUrl.replace(/\/+$/, "");
  const listPath = (opts.listPath ?? "--Inventory").replace(/^\/+/, "");
  let scanned = 0;
  const maxPages = opts.usedOnly !== false ? 40 : 20;

  const conditionVariants =
    opts.listConditions && opts.listConditions.length > 0
      ? opts.listConditions
      : opts.usedOnly !== false
        ? USED_LIST_CONDITIONS
        : [null];

  for (const condition of conditionVariants) {
    if (scanned >= opts.maxScans) return;

    for (let page = 1; page <= maxPages && scanned < opts.maxScans; page += 1) {
      const params = new URLSearchParams();
      params.set("pg", String(page));
      params.set("sz", String(LIST_PAGE_SIZE));
      if (condition) params.set("condition", condition);
      applyListExtraParams(params, opts.listExtraParams);

      const listUrl = `${base}/${listPath}?${params.toString()}`;
      let html: string;
      try {
        html = await fetchText(listUrl);
      } catch {
        break;
      }
      const oids = extractOidsFromHtml(html).filter((oid) => !opts.seenSourceIds.has(`${importSource}:${oid}`));
      if (oids.length === 0) {
        if (page === 1) break;
        break;
      }

      for (let i = 0; i < oids.length && scanned < opts.maxScans; i += DETAIL_CONCURRENCY) {
        const batch = oids.slice(i, i + DETAIL_CONCURRENCY);
        scanned += batch.length;
        const details = await fetchDetailRows(base, batch);
        for (const { oid, row } of details) {
          if (scanned > opts.maxScans) return;
          if (!row) continue;
          if (opts.usedOnly !== false && !isUsedInventoryCondition(row.condition)) continue;

          const candidate = mapDetailToCandidate(row, base, importSource, opts.skipFirstPhoto);
          if (!candidate) continue;
          opts.seenSourceIds.add(`${importSource}:${oid}`);
          yield candidate;
        }
      }

      if (oids.length < LIST_PAGE_SIZE) break;
    }

    if (scanned > 0) return;
  }
}

const OID_FROM_TEXT_RE = /oid(?:=|%3D|%26#x3D;|&#x3D;)(\d+)/i;

export function extractDealerSpikeOid(raw: string): string | null {
  try {
    const u = new URL(raw);
    for (const key of ["oid", "OID", "invid"]) {
      const v = u.searchParams.get(key);
      if (v && /^\d+$/.test(v)) return v;
    }
  } catch {
    /* not a full URL */
  }
  const m = raw.match(OID_FROM_TEXT_RE);
  return m?.[1] ?? null;
}

function hostnameKey(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "").replace(/\./g, "_");
}

export async function candidateFromDealerSpikeUrl(pageUrl: string): Promise<UsImportCandidate | null> {
  let parsed: URL;
  try {
    parsed = new URL(pageUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const base = `${parsed.protocol}//${parsed.hostname}`;
  let oid = extractDealerSpikeOid(pageUrl);

  if (!oid) {
    try {
      const html = await fetchText(pageUrl);
      oid = extractDealerSpikeOid(html) ?? extractOidsFromHtml(html)[0] ?? null;
    } catch {
      return null;
    }
  }
  if (!oid) return null;

  const row = await fetchDetailRow(base, oid);
  if (!row) return null;

  const importSource = `url_dealer_spike_${hostnameKey(parsed.hostname)}`;
  const candidate = mapDetailToCandidate(row, base, importSource);
  if (!candidate) return null;
  return { ...candidate, permalink: pageUrl.split("#")[0] ?? candidate.permalink };
}
