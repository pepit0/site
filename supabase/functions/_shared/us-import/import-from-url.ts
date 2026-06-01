import { candidateFromDealerSpikeUrl, mapDealerSpikeCategory } from "./dealer-spike.ts";
import { candidateFromListivoUrl } from "./listivo.ts";
import { candidateFromWooCommerceUrl } from "./woocommerce.ts";
import type { UsImportCandidate, VehicleCategory } from "./types.ts";
import { dedupeUrls, sanitizeImportLabel } from "./types.ts";

const UA = "TemptationMotorsportsImport/1.0";

export type UrlImportAttempt = {
  adapter: string;
  error?: string;
};

export type UrlImportResult =
  | { ok: true; candidate: UsImportCandidate; adapter: string; attempts: UrlImportAttempt[] }
  | { ok: false; error: string; attempts: UrlImportAttempt[] };

function hostnameKey(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "").replace(/\./g, "_");
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { Accept: "text/html,application/xhtml+xml,*/*", "User-Agent": UA },
    redirect: "follow"
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function metaContent(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const m = html.match(re);
  return m?.[1]?.trim() ?? null;
}

function extractJsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = m[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch {
      /* skip invalid JSON-LD */
    }
  }
  return out;
}

function flattenJsonLd(nodes: unknown[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const o = node as Record<string, unknown>;
    if (Array.isArray(o["@graph"])) {
      for (const g of o["@graph"]) {
        if (g && typeof g === "object") out.push(g as Record<string, unknown>);
      }
    } else {
      out.push(o);
    }
  }
  return out;
}

function jsonLdType(node: Record<string, unknown>): string {
  const t = node["@type"];
  if (typeof t === "string") return t.toLowerCase();
  if (Array.isArray(t) && typeof t[0] === "string") return t[0].toLowerCase();
  return "";
}

function brandName(node: Record<string, unknown>): string | null {
  const brand = node.brand;
  if (typeof brand === "string" && brand.trim()) return brand.trim();
  if (brand && typeof brand === "object") {
    const name = (brand as Record<string, unknown>).name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return null;
}

function parseYearFromText(text: string): number | null {
  const m = text.match(/\b(19|20)\d{2}\b/);
  if (!m) return null;
  const y = Number.parseInt(m[0], 10);
  return Number.isFinite(y) && y >= 1900 && y <= 2100 ? y : null;
}

function guessCategory(text: string): VehicleCategory {
  const s = text.toLowerCase();
  if (s.includes("snowmobile")) return "Snowmobile";
  if (s.includes("side-by-side") || s.includes("side by side") || s.includes("sxs") || s.includes("utv")) {
    return "Side by side";
  }
  if (s.includes("atv") || s.includes("quad")) return "ATV";
  if (s.includes("pwc") || s.includes("jet ski") || s.includes("jetski") || s.includes("watercraft") || s.includes("boat")) {
    return "Watercraft";
  }
  if (s.includes("trailer")) return "Trailer";
  return "Motorcycle";
}

function parseOdometerFromText(text: string): number | null {
  const mi = text.match(/([\d,]+)\s*(?:mi|miles)\b/i);
  if (mi?.[1]) {
    const n = Number.parseInt(mi[1].replace(/,/g, ""), 10);
    if (Number.isFinite(n) && n >= 0) return Math.round(n * 1.60934);
  }
  const km = text.match(/([\d,]+)\s*(?:km|kilometers)\b/i);
  if (km?.[1]) {
    const n = Number.parseInt(km[1].replace(/,/g, ""), 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

function extractImageUrls(html: string, baseUrl: string): string[] {
  const urls: string[] = [];
  const og = metaContent(html, "og:image");
  if (og) urls.push(og);
  for (const m of html.matchAll(/<meta[^>]+property=["']og:image(?::\d+)?["'][^>]+content=["']([^"']+)["']/gi)) {
    if (m[1]) urls.push(m[1]);
  }
  for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
    const src = m[1]?.trim();
    if (!src || src.startsWith("data:")) continue;
    try {
      urls.push(new URL(src, baseUrl).href);
    } catch {
      /* skip bad URLs */
    }
  }
  return dedupeUrls(urls);
}

async function candidateFromGenericHtml(pageUrl: string): Promise<UsImportCandidate | null> {
  let parsed: URL;
  try {
    parsed = new URL(pageUrl);
  } catch {
    return null;
  }

  const html = await fetchHtml(pageUrl);
  const base = `${parsed.protocol}//${parsed.hostname}`;
  const title =
    metaContent(html, "og:title") ??
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ??
    null;
  if (!title) return null;

  const ldNodes = flattenJsonLd(extractJsonLdBlocks(html));
  let make: string | null = null;
  let model: string | null = null;
  let year: number | null = parseYearFromText(title);
  let odometerKm: number | null = parseOdometerFromText(html);

  for (const node of ldNodes) {
    const type = jsonLdType(node);
    if (!type.includes("vehicle") && !type.includes("product") && !type.includes("car")) continue;
    make = make ?? brandName(node);
    if (typeof node.model === "string" && node.model.trim()) model = node.model.trim();
    if (typeof node.name === "string" && node.name.trim() && !model) {
      const name = node.name.trim();
      if (!make) make = brandName(node);
      if (!year) year = parseYearFromText(name);
      if (!model) {
        const stripped = name.replace(/\b(19|20)\d{2}\b/, "").trim();
        if (make && stripped.toLowerCase().startsWith(make.toLowerCase())) {
          model = stripped.slice(make.length).trim();
        } else if (stripped) {
          model = stripped;
        }
      }
    }
    const date = node.vehicleModelDate ?? node.modelDate ?? node.releaseDate;
    if (!year && date != null) year = parseYearFromText(String(date));
    const mileage = node.mileageFromOdometer;
    if (odometerKm == null && mileage && typeof mileage === "object") {
      const v = (mileage as Record<string, unknown>).value ?? (mileage as Record<string, unknown>).name;
      if (v != null) odometerKm = parseOdometerFromText(String(v));
    }
  }

  if (!make || !model) {
    const titleParts = title.replace(/\s+/g, " ").trim();
    if (!year) year = parseYearFromText(titleParts);
    const withoutYear = titleParts.replace(/\b(19|20)\d{2}\b/, "").trim();
    const tokens = withoutYear.split(/\s+/).filter(Boolean);
    if (tokens.length >= 2) {
      make = make ?? tokens[0] ?? null;
      model = model ?? tokens.slice(1).join(" ") ?? null;
    }
  }

  if (!make || !model || !year) return null;

  make = sanitizeImportLabel(make) || null;
  model = sanitizeImportLabel(model) || null;
  if (!make || !model) return null;

  const category =
    ldNodes
      .map((n) => {
        const catText = [jsonLdType(n), String(n.category ?? ""), String(n.bodyType ?? ""), title].join(" ");
        const ds = mapDealerSpikeCategory(catText, "");
        return ds ?? guessCategory(catText);
      })
      .find(Boolean) ?? guessCategory(title);

  const photoUrls = extractImageUrls(html, base);
  const importSource = `url_html_${hostnameKey(parsed.hostname)}`;
  const slug = parsed.pathname.split("/").filter(Boolean).pop() ?? "listing";
  let hash = 0;
  for (const ch of pageUrl) hash = (Math.imul(31, hash) + ch.charCodeAt(0)) | 0;
  const id = `${slug}_${Math.abs(hash)}`;

  return {
    sourceProductId: id,
    stockNumber: `URL-${id.slice(-8).toUpperCase()}`,
    year,
    make,
    model,
    odometerKm,
    category,
    photoUrls,
    permalink: pageUrl.split("#")[0] ?? pageUrl,
    title,
    sourceNotes: `Imported from link\nSource: ${pageUrl}`,
    importSource
  };
}

export function passesUrlImportFilter(c: UsImportCandidate): { ok: true } | { ok: false; reason: string } {
  if (!c.make?.trim() || !c.model?.trim()) {
    return { ok: false, reason: "Missing make or model on the listing." };
  }
  if (!Number.isFinite(c.year) || c.year! < 1900 || c.year! > 2100) {
    return { ok: false, reason: "Missing or invalid year on the listing." };
  }
  if (!c.category) {
    return { ok: false, reason: "Could not determine vehicle category." };
  }
  if (c.photoUrls.length < 1) {
    return { ok: false, reason: "No photos found on the listing." };
  }
  return { ok: true };
}

export function previewFromCandidate(candidate: UsImportCandidate, adapter: string) {
  return {
    adapter,
    make: candidate.make!,
    model: candidate.model!,
    year: candidate.year!,
    category: candidate.category,
    odometerKm: candidate.odometerKm,
    photoCount: candidate.photoUrls.length,
    title: candidate.title,
    permalink: candidate.permalink,
    importSource: candidate.importSource,
    sourceProductId: candidate.sourceProductId
  };
}

export async function importCandidateFromUrl(pageUrl: string): Promise<UrlImportResult> {
  const trimmed = pageUrl.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter a listing URL.", attempts: [] };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "Invalid URL.", attempts: [] };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "URL must start with http:// or https://", attempts: [] };
  }

  const attempts: UrlImportAttempt[] = [];
  const tryAdapter = async (adapter: string, fn: () => Promise<UsImportCandidate | null>) => {
    try {
      const candidate = await fn();
      if (candidate) {
        return { ok: true as const, candidate, adapter };
      }
      attempts.push({ adapter, error: "No matching listing data." });
    } catch (e) {
      attempts.push({ adapter, error: e instanceof Error ? e.message : "Failed." });
    }
    return null;
  };

  const order: Array<[string, () => Promise<UsImportCandidate | null>]> = [
    ["dealer_spike", () => candidateFromDealerSpikeUrl(trimmed)],
    ["listivo", () => candidateFromListivoUrl(trimmed)],
    ["woocommerce", () => candidateFromWooCommerceUrl(trimmed)],
    ["html", () => candidateFromGenericHtml(trimmed)]
  ];

  for (const [adapter, fn] of order) {
    const hit = await tryAdapter(adapter, fn);
    if (hit?.ok) {
      const check = passesUrlImportFilter(hit.candidate);
      if (!check.ok) {
        return { ok: false, error: check.reason, attempts };
      }
      return { ok: true, candidate: hit.candidate, adapter: hit.adapter, attempts };
    }
  }

  return {
    ok: false,
    error:
      "Could not import this URL. Supported: Dealer Spike inventory pages, WordPress Listivo/WooCommerce listings, or pages with structured vehicle data (JSON-LD / Open Graph).",
    attempts
  };
}
