import {
  buildSourceNotes,
  dedupeUrls,
  milesToKm,
  sanitizeImportLabel,
  type SearchOpts,
  type UsImportCandidate,
  type VehicleCategory
} from "./types.ts";

const UA = "TemptationMotorsportsImport/1.0";

type Dx1Photo = { Seq?: number; Url?: string };
type Dx1Hit = {
  objectID?: string;
  ProductId?: string;
  StockNumber?: string;
  Manufacturer?: string;
  ProductName?: string;
  ProductType?: string;
  ProductCategory?: string;
  Year?: number;
  Odometer?: number;
  OdometerUomCode?: string;
  Condition?: string;
  Price?: number;
  Vin?: string;
  ShowroomUrl?: string;
  DealershipName?: string;
  PhotoLists?: Dx1Photo[];
  PhotoUrl?: string;
  NumberPhoto?: number;
};

export type Dx1SourceConfig = {
  listPath?: string;
  algoliaFilter?: string;
};

function mapDx1Category(productCategory: string | null, productType: string | null): VehicleCategory | null {
  const c = (productCategory ?? "").toLowerCase();
  const t = (productType ?? "").toLowerCase();
  if (c.includes("snowmobile") || t.includes("snowmobile") || t.includes("summit") || t.includes("ski-doo")) {
    return "Snowmobile";
  }
  if (
    c.includes("watercraft") ||
    c.includes("marine") ||
    c.includes("boat") ||
    c.includes("pwc") ||
    t.includes("sea-doo") ||
    t.includes("jet ski")
  ) {
    return "Watercraft";
  }
  if (c.includes("atv") || t.includes("sportsman") || t.includes("outlander")) return "ATV";
  if (
    c.includes("utility") ||
    c.includes("side") ||
    t.includes("rzr") ||
    t.includes("ranger") ||
    t.includes("teryx") ||
    t.includes("mule") ||
    t.includes("wolverine") ||
    t.includes("viking") ||
    t.includes("xpedition") ||
    t.includes("zforce")
  ) {
    return "Side by side";
  }
  if (c.includes("motorcycle") || c.includes("scooter") || t.includes("sport") || t.includes("dirt")) {
    return "Motorcycle";
  }
  if (c.includes("trailer")) return "Trailer";
  return null;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { Accept: "text/html,application/xhtml+xml,*/*", "User-Agent": UA },
    redirect: "follow"
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

async function loadAlgoliaCredentials(
  baseUrl: string,
  listPath: string
): Promise<{ appId: string; apiKey: string; indexName: string }> {
  const url = `${baseUrl.replace(/\/+$/, "")}${listPath.startsWith("/") ? listPath : `/${listPath}`}`;
  const html = await fetchHtml(url);
  const appId =
    html.match(/applicationId['":\s]+['"]([^'"]+)/i)?.[1] ??
    html.match(/appId['":\s]+['"]([^'"]+)/i)?.[1];
  const apiKey = html.match(/apiKey['":\s]+['"]([^'"]+)/i)?.[1];
  const indexName = html.match(/indexName['":\s]+['"](prod_WebSellable)['"]/i)?.[1] ?? "prod_WebSellable";
  if (!appId || !apiKey) throw new Error(`DX1 Algolia credentials not found (${url})`);
  return { appId, apiKey, indexName };
}

function photosFromHit(hit: Dx1Hit): string[] {
  const urls: string[] = [];
  if (Array.isArray(hit.PhotoLists)) {
    const sorted = [...hit.PhotoLists].sort((a, b) => (a.Seq ?? 0) - (b.Seq ?? 0));
    for (const p of sorted) {
      if (typeof p.Url === "string" && p.Url.trim()) urls.push(p.Url.trim());
    }
  }
  if (urls.length === 0 && typeof hit.PhotoUrl === "string" && hit.PhotoUrl.trim()) {
    urls.push(hit.PhotoUrl.trim());
  }
  return dedupeUrls(urls);
}

function mapHitToCandidate(hit: Dx1Hit, importSource: string): UsImportCandidate | null {
  const sourceProductId = typeof hit.objectID === "string" ? hit.objectID : null;
  if (!sourceProductId) return null;

  const category = mapDx1Category(hit.ProductCategory ?? null, hit.ProductType ?? null);
  if (!category) return null;

  const make = sanitizeImportLabel(hit.Manufacturer);
  const model = sanitizeImportLabel(hit.ProductName);
  const year = typeof hit.Year === "number" ? hit.Year : null;
  if (!make || !model || !year || year < 1900 || year > 2100) return null;

  const stock = (hit.StockNumber ?? "").trim() || `DX1-${sourceProductId.slice(0, 8)}`;
  const photoUrls = photosFromHit(hit);
  const miles =
    typeof hit.Odometer === "number" && Number.isFinite(hit.Odometer) && hit.Odometer >= 0 ? hit.Odometer : null;

  const priceNote =
    typeof hit.Price === "number" && hit.Price > 0 ? `$${hit.Price.toLocaleString("en-US")}` : null;

  const sourceNotes = buildSourceNotes([
    hit.DealershipName ? `US source: ${hit.DealershipName}` : null,
    priceNote ? `Listed price: USD ${priceNote.replace(/^\$/, "")}` : null,
    hit.Condition ? `Condition: ${hit.Condition}` : null,
    hit.Vin ? `VIN: ${hit.Vin}` : null,
    hit.ShowroomUrl ? `Source: ${hit.ShowroomUrl}` : null
  ]);

  return {
    sourceProductId,
    stockNumber: stock,
    year,
    make,
    model,
    odometerKm: miles != null ? milesToKm(miles) : null,
    category,
    photoUrls,
    permalink: hit.ShowroomUrl?.trim() || null,
    title: `${year} ${make} ${model}`.trim(),
    sourceNotes,
    importSource
  };
}

async function queryAlgoliaPage(
  creds: { appId: string; apiKey: string; indexName: string },
  filter: string,
  page: number,
  hitsPerPage: number
): Promise<{ hits: Dx1Hit[]; nbPages: number }> {
  const params = new URLSearchParams();
  params.set("hitsPerPage", String(hitsPerPage));
  params.set("page", String(page));
  if (filter) params.set("filters", filter);

  const res = await fetch(`https://${creds.appId.toLowerCase()}-dsn.algolia.net/1/indexes/*/queries`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Algolia-Application-Id": creds.appId,
      "X-Algolia-API-Key": creds.apiKey
    },
    body: JSON.stringify({
      requests: [{ indexName: creds.indexName, params: params.toString() }]
    })
  });
  if (!res.ok) throw new Error(`Algolia HTTP ${res.status}`);
  const data = await res.json();
  const result = data.results?.[0];
  return {
    hits: (result?.hits ?? []) as Dx1Hit[],
    nbPages: typeof result?.nbPages === "number" ? result.nbPages : 0
  };
}

export async function* scanDx1UsedCatalog(
  baseUrl: string,
  importSource: string,
  config: Dx1SourceConfig,
  opts: { seenSourceIds: Set<string>; maxScans?: number }
): AsyncGenerator<UsImportCandidate> {
  const listPath = config.listPath ?? "/Inventory/Used-Inventory";
  const filter = config.algoliaFilter ?? "Condition:Used";
  const creds = await loadAlgoliaCredentials(baseUrl, listPath);
  const hitsPerPage = 50;
  let scanned = 0;
  const maxScans = opts.maxScans ?? 5000;

  for (let page = 0; ; page += 1) {
    const { hits, nbPages } = await queryAlgoliaPage(creds, filter, page, hitsPerPage);
    if (hits.length === 0) break;

    for (const hit of hits) {
      scanned += 1;
      if (scanned > maxScans) return;
      const id = hit.objectID;
      if (!id || opts.seenSourceIds.has(`${importSource}:${id}`)) continue;
      const candidate = mapHitToCandidate(hit, importSource);
      if (!candidate) continue;
      opts.seenSourceIds.add(`${importSource}:${id}`);
      yield candidate;
    }

    if (page + 1 >= nbPages) break;
  }
}

export async function* searchDx1(
  baseUrl: string,
  importSource: string,
  config: Dx1SourceConfig,
  opts: SearchOpts
): AsyncGenerator<UsImportCandidate> {
  let yielded = 0;
  for await (const candidate of scanDx1UsedCatalog(baseUrl, importSource, config, {
    seenSourceIds: opts.seenSourceIds,
    maxScans: opts.maxScans
  })) {
    if (yielded >= opts.maxYields || opts.seenSourceIds.size > opts.maxScans) return;
    if (candidate.category !== opts.category) continue;
    yielded += 1;
    yield candidate;
  }
}
