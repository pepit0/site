import type { SearchOpts, UsImportCandidate, VehicleCategory } from "./types.ts";
import { dedupeUrls, normalizeStock, sanitizeImportLabel } from "./types.ts";

function firstString(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function attrTerm(attrs: unknown, ...names: string[]): string | null {
  if (!Array.isArray(attrs)) return null;
  const want = names.map((n) => n.toLowerCase());
  for (const a of attrs) {
    if (!a || typeof a !== "object") continue;
    const o = a as Record<string, unknown>;
    const n = firstString(o.name);
    if (!n || !want.includes(n.toLowerCase())) continue;
    const terms = o.terms;
    if (!Array.isArray(terms) || terms.length < 1) continue;
    const t0 = terms[0];
    if (!t0 || typeof t0 !== "object") continue;
    return firstString((t0 as Record<string, unknown>).name);
  }
  return null;
}

function mapWooCategory(cats: unknown): VehicleCategory {
  if (!Array.isArray(cats)) return "Motorcycle";
  const list = cats
    .filter((c) => c && typeof c === "object")
    .map((c) => {
      const o = c as Record<string, unknown>;
      return { slug: (firstString(o.slug) ?? "").toLowerCase(), name: (firstString(o.name) ?? "").toLowerCase() };
    });

  const matchSlug = (...slugs: string[]) => list.some((c) => slugs.includes(c.slug));
  if (matchSlug("side-by-side", "side_by_side", "side-by-sides")) return "Side by side";
  if (matchSlug("atv", "atvs")) return "ATV";
  if (matchSlug("snowmobile", "snowmobiles")) return "Snowmobile";
  if (matchSlug("motorcycle", "motorcycles")) return "Motorcycle";
  if (matchSlug("marine", "watercraft", "pontoon", "boat", "boats", "pwc")) return "Watercraft";
  if (matchSlug("trailer", "trailers", "rv")) return "Trailer";
  return "Motorcycle";
}

function parseYear(raw: string | null): number | null {
  if (!raw) return null;
  const y = Number.parseInt(raw.replace(/\D/g, ""), 10);
  return Number.isFinite(y) && y >= 1900 && y <= 2100 ? y : null;
}

function parseOdometerKm(raw: string | null): number | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  if (lower.includes("mi")) return Math.round(n * 1.60934);
  return n;
}

function mapWooProduct(p: unknown, importSource: string, baseUrl: string): UsImportCandidate | null {
  if (!p || typeof p !== "object") return null;
  const o = p as Record<string, unknown>;
  const id = o.id;
  const pid = typeof id === "number" && Number.isFinite(id) ? String(id) : typeof id === "string" ? id : null;
  if (!pid) return null;

  const make = sanitizeImportLabel(attrTerm(o.attributes, "Make")) || null;
  const model = sanitizeImportLabel(attrTerm(o.attributes, "Model")) || null;
  const year = parseYear(attrTerm(o.attributes, "Year"));
  if (!make || !model || !year) return null;

  const kmRaw = attrTerm(o.attributes, "Kilometers", "Kilometer", "Odometer", "Mileage");
  const odometerKm = parseOdometerKm(kmRaw);

  const images = o.images;
  const urls: string[] = [];
  if (Array.isArray(images)) {
    for (const im of images) {
      if (!im || typeof im !== "object") continue;
      const src = firstString((im as Record<string, unknown>).src);
      if (src) urls.push(src);
    }
  }
  const photoUrls = dedupeUrls(urls);

  const name = firstString(o.name);
  const permalink = firstString(o.permalink);
  const prices = o.prices as Record<string, unknown> | undefined;
  const priceStr =
    prices && typeof prices.price === "string"
      ? prices.price
      : prices && typeof prices.regular_price === "string"
        ? prices.regular_price
        : null;

  const stock = normalizeStock(`US-WOO-${pid}`);

  return {
    sourceProductId: pid,
    stockNumber: stock,
    year,
    make,
    model,
    odometerKm,
    category: mapWooCategory(o.categories),
    photoUrls,
    permalink,
    title: name,
    sourceNotes: [priceStr ? `Listed price: ${priceStr}` : null, permalink ? `Source: ${permalink}` : null]
      .filter(Boolean)
      .join("\n") || null,
    importSource
  };
}

async function fetchWooPage(baseUrl: string, page: number): Promise<unknown[]> {
  const base = baseUrl.replace(/\/+$/, "");
  const url = `${base}/wp-json/wc/store/v1/products?per_page=100&page=${page}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "TemptationMotorsportsImport/1.0" }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function* searchWooCommerce(
  baseUrl: string,
  importSource: string,
  opts: SearchOpts
): AsyncGenerator<UsImportCandidate> {
  let yielded = 0;
  let scanned = 0;
  for (let page = 1; page <= 20 && yielded < opts.maxYields && scanned < opts.maxScans; page += 1) {
    let products: unknown[];
    try {
      products = await fetchWooPage(baseUrl, page);
    } catch {
      break;
    }
    if (products.length === 0) break;

    for (const p of products) {
      if (yielded >= opts.maxYields || scanned >= opts.maxScans) return;
      scanned += 1;
      const candidate = mapWooProduct(p, importSource, baseUrl);
      if (!candidate || candidate.category !== opts.category) continue;
      const key = `${importSource}:${candidate.sourceProductId}`;
      if (opts.seenSourceIds.has(key)) continue;
      opts.seenSourceIds.add(key);
      yielded += 1;
      yield candidate;
    }
    if (products.length < 100) break;
  }
}

function hostnameKey(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "").replace(/\./g, "_");
}

function slugFromPath(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  return parts[parts.length - 1] ?? null;
}

async function fetchWooBySlug(baseUrl: string, slug: string): Promise<unknown | null> {
  const base = baseUrl.replace(/\/+$/, "");
  const url = `${base}/wp-json/wc/store/v1/products?slug=${encodeURIComponent(slug)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "TemptationMotorsportsImport/1.0" }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data) && data[0] ? data[0] : null;
}

export async function candidateFromWooCommerceUrl(pageUrl: string): Promise<UsImportCandidate | null> {
  let parsed: URL;
  try {
    parsed = new URL(pageUrl);
  } catch {
    return null;
  }

  const base = `${parsed.protocol}//${parsed.hostname}`;
  const slug = slugFromPath(parsed.pathname);
  if (!slug) return null;

  const product = await fetchWooBySlug(base, slug);
  if (!product) return null;

  const importSource = `url_woocommerce_${hostnameKey(parsed.hostname)}`;
  const candidate = mapWooProduct(product, importSource, base);
  if (!candidate) return null;
  return { ...candidate, permalink: pageUrl.split("#")[0] ?? candidate.permalink };
}
