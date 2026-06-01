/**
 * Quick probe: count Dealer Spike OIDs per source + detect Woo/Listivo.
 * Usage: node scripts/probe-us-inventory-counts.mjs [url ...]
 */

const UA = "TemptationMotorsportsImport/1.0";
const OID_RE = /oid(?:=|%3D|%26#x3D;|&#x3D;)(\d+)/gi;

const DEFAULTS = [
  "https://www.ridenow.com",
  "https://www.foxpowersports.com",
  "https://www.heartlandhonda.com",
  "https://www.hondaws.com",
  "https://www.lakecycle.com",
  "https://www.bertsmegamall.com",
  "https://www.boatcountryusa.com",
  "https://www.sandspowersports.com",
  "https://www.northcountrypowersports.com",
  "https://www.royalpowersports.net",
  "https://www.motoworldhouston.com",
  "https://www.grandprairiehonda.com",
  "https://www.ironhorsepowersports.net",
  "https://www.lynnsrv.com",
  "https://www.rvworldwide.com",
  "https://www.trailersoftheeastcoast.com",
  "https://www.snowmobileshop.com",
  "https://www.jjpowersports.com",
  "https://www.powersportsmax.com",
  "https://www.ajcycle.com"
];

async function countOids(base, condition) {
  const params = new URLSearchParams({ pg: "1", sz: "50" });
  if (condition) params.set("condition", condition);
  const url = `${base.replace(/\/+$/, "")}/--Inventory?${params.toString()}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "text/html,*/*", "User-Agent": UA },
      redirect: "follow"
    });
    const html = await res.text();
    const oids = new Set();
    for (const m of html.matchAll(OID_RE)) oids.add(m[1]);
    return { status: res.status, oids: oids.size };
  } catch (e) {
    return { status: 0, oids: 0, err: e instanceof Error ? e.message : "fetch failed" };
  }
}

async function probeWoo(base) {
  const url = `${base.replace(/\/+$/, "")}/wp-json/wc/store/v1/products?per_page=1`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": UA } });
    const t = await res.text();
    return res.ok && t.includes('"id"');
  } catch {
    return false;
  }
}

async function probeListivo(base) {
  const url = `${base.replace(/\/+$/, "")}/wp-json/wp/v2/listings?per_page=1`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": UA } });
    const t = await res.text();
    return res.ok && !t.includes("rest_no_route") && t.trimStart().startsWith("[");
  } catch {
    return false;
  }
}

async function probeDetail(base) {
  const list = await countOids(base, "Pre-Owned");
  if (list.oids === 0) return null;
  const url = `${base.replace(/\/+$/, "")}/--Inventory?pg=1&sz=50&condition=Pre-Owned`;
  const res = await fetch(url, { headers: { Accept: "text/html,*/*", "User-Agent": UA } });
  const html = await res.text();
  const oid = [...html.matchAll(OID_RE)][0]?.[1];
  if (!oid) return null;
  const detailUrl = `${base.replace(/\/+$/, "")}/--xInventoryDetail?oid=${oid}&format=json`;
  const dr = await fetch(detailUrl, { headers: { Accept: "application/json,*/*", "User-Agent": UA } });
  if (!dr.ok) return { oid, detailOk: false, status: dr.status };
  const row = (await dr.json())?.[0];
  return {
    oid,
    detailOk: true,
    category: row?.category,
    subcategory: row?.subcategory,
    condition: row?.condition,
    images: row?.assetimagecount ?? row?.aImages?.length ?? 0
  };
}

function mapDealerSpikeCategory(vtype, subcategory) {
  const t = (vtype ?? "").toLowerCase();
  const s = (subcategory ?? "").toLowerCase();
  if (t.includes("snowmobile") || s.includes("snowmobile")) return "Snowmobile";
  if (t.includes("boat") || t.includes("personal watercraft") || t.includes("watercraft") || t.includes("pwc") || s.includes("jet")) {
    return "Watercraft";
  }
  if (t.includes("motorcycle") || t.includes("scooter")) return "Motorcycle";
  if (t.includes("atv")) return "ATV";
  if (t.includes("utility vehicle") || t.includes("side-by-side") || t.includes("side by side") || t === "sxs") {
    return "Side by side";
  }
  if (t.includes("trailer") || t.includes("rv") || t.includes("travel")) return "Trailer";
  return null;
}

async function sampleMappedCategories(base, maxDetails = 20) {
  const url = `${base.replace(/\/+$/, "")}/--Inventory?pg=1&sz=50&condition=Pre-Owned`;
  const html = await (await fetch(url, { headers: { Accept: "text/html,*/*", "User-Agent": UA } })).text();
  const oids = [...html.matchAll(OID_RE)].map((m) => m[1]).slice(0, maxDetails);
  const mapped = {};
  for (const oid of oids) {
    const dr = await fetch(`${base.replace(/\/+$/, "")}/--xInventoryDetail?oid=${oid}&format=json`, {
      headers: { Accept: "application/json,*/*", "User-Agent": UA }
    });
    if (!dr.ok) continue;
    const row = (await dr.json())?.[0];
    if (!row || String(row.condition ?? "").toUpperCase() !== "USED") continue;
    const cat = mapDealerSpikeCategory(row.category, row.subcategory) ?? "UNMAPPED";
    mapped[cat] = (mapped[cat] ?? 0) + 1;
  }
  return mapped;
}

const bases = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULTS;

console.log("US inventory source probe\n");

for (const base of bases) {
  const preOwned = await countOids(base, "Pre-Owned");
  const used = await countOids(base, "Used");
  const all = await countOids(base, null);
  const woo = await probeWoo(base);
  const listivo = await probeListivo(base);
  const dsCount = Math.max(preOwned.oids, used.oids, all.oids);
  let adapter = "none";
  if (dsCount > 0) adapter = "dealer_spike";
  else if (woo) adapter = "woocommerce";
  else if (listivo) adapter = "listivo";

  const sample = adapter === "dealer_spike" ? await probeDetail(base) : null;
  const mapped = adapter === "dealer_spike" ? await sampleMappedCategories(base, 15) : null;

  console.log(`${base}`);
  console.log(`  adapter: ${adapter}`);
  console.log(`  oids page1: Pre-Owned=${preOwned.oids} Used=${used.oids} all=${all.oids}`);
  if (sample) console.log(`  sample: ${JSON.stringify(sample)}`);
  if (mapped) console.log(`  mapped (first 15 used): ${JSON.stringify(mapped)}`);
  console.log("");
}
