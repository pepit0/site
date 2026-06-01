/**
 * Batch-probe US powersports dealers for import adapters + Pre-Owned list depth.
 * Usage: node scripts/probe-us-dealer-batch.mjs
 */

const CANDIDATES = [
  "https://www.ridenow.com",
  "https://www.cyclecityhonolulu.com",
  "https://www.ridefoxpowersports.com",
  "https://www.larrysmx.com",
  "https://www.babesm.com",
  "https://www.motoworldofelcajon.com",
  "https://www.ironhorseharley.com",
  "https://www.rockymountainatv.com",
  "https://www.denniskirk.com",
  "https://www.polaris.com",
  "https://www.hallsports.com",
  "https://www.royalsportsgroup.com",
  "https://www.motosport.com",
  "https://www.foxpowersports.com",
  "https://www.pompspowersports.com",
  "https://www.vforcemarine.com",
  "https://www.sunenterprises.com",
  "https://www.heartlandhonda.com",
  "https://www.bmwseattle.com",
  "https://www.vespariverside.com",
  "https://www.pgatmotorsports.com",
  "https://www.atvtrader.com",
  "https://www.cycletrader.com",
  "https://www.rvuniverse.com",
  "https://www.greenvilleharley.com",
  "https://www.motorcyclemall.com",
  "https://www.rideaprilia.com",
  "https://www.kenstonestoyota.com",
  "https://www.powersportssuperstore.com",
  "https://www.ridecenterusa.com",
  "https://www.azpowersports.com",
  "https://www.ultimatecycle.com",
  "https://www.motoworldracing.com",
  "https://www.hondaws.com",
  "https://www.yamahaoftroy.com"
];

const OID_RE = /oid(?:=|%3D|%26#x3D;|&#x3D;)(\d+)/gi;

async function probe(base) {
  const out = { base, adapters: [], preOwnedOids: 0, notes: [] };
  const probes = [
    ["woocommerce", "/wp-json/wc/store/v1/products?per_page=1"],
    ["listivo", "/wp-json/wp/v2/listings?per_page=1"],
    ["inventory_presser", "/wp-json/wp/v2/inventory_vehicle?per_page=1"]
  ];
  for (const [key, path] of probes) {
    try {
      const res = await fetch(`${base}${path}`, {
        headers: { Accept: "application/json", "User-Agent": "TemptationMotorsportsImport/1.0" },
        redirect: "follow"
      });
      const text = await res.text();
      const ok =
        key === "woocommerce"
          ? res.ok && text.includes('"id"')
          : key === "listivo"
            ? res.ok && !text.includes("rest_no_route") && text.includes('"id"')
            : res.ok && !text.includes("rest_no_route") && (text.includes('"id"') || text.startsWith("["));
      if (ok) out.adapters.push(key);
    } catch {
      /* skip */
    }
  }

  for (const cond of ["Pre-Owned", "USED", "Used"]) {
    try {
      const url = `${base}/--Inventory?pg=1&sz=50&condition=${encodeURIComponent(cond)}`;
      const res = await fetch(url, { headers: { "User-Agent": "TemptationMotorsportsImport/1.0" } });
      const html = await res.text();
      const oids = [...new Set([...html.matchAll(OID_RE)].map((m) => m[1]))];
      if (oids.length > 0) {
        out.adapters.push("dealer_spike");
        out.preOwnedOids = oids.length;
        out.notes.push(`condition=${cond} oids=${oids.length}`);
        break;
      }
    } catch {
      /* skip */
    }
  }

  out.adapters = [...new Set(out.adapters)];
  return out;
}

async function verifyDealerSpikeUsed(base, sampleOid) {
  try {
    const res = await fetch(`${base}/--xInventoryDetail?oid=${sampleOid}&format=json`, {
      headers: { Accept: "application/json" }
    });
    const data = await res.json();
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return {
      condition: row.condition,
      category: row.category,
      photos: Array.isArray(row.aImages) ? row.aImages.length : 0,
      year: row.year,
      make: row.make,
      model: row.model
    };
  } catch {
    return null;
  }
}

console.log("Probing US dealer candidates...\n");
const good = [];
for (const base of CANDIDATES) {
  const r = await probe(base);
  const tag = r.adapters.length ? r.adapters.join("+") : "none";
  console.log(`${r.preOwnedOids ? "✓" : r.adapters.length ? "~" : "✗"} ${base} [${tag}] ${r.notes.join(" ")}`);
  if (r.adapters.includes("dealer_spike") && r.preOwnedOids >= 10) {
    good.push({ base, adapters: r.adapters, preOwnedOids: r.preOwnedOids });
  } else if (r.adapters.includes("woocommerce") || r.adapters.includes("listivo")) {
    good.push({ base, adapters: r.adapters, preOwnedOids: r.preOwnedOids });
  }
}

console.log("\n=== Recommended registry entries ===");
const entries = good.map((g, i) => {
  let hostname;
  try {
    hostname = new URL(g.base).hostname.replace(/^www\./, "").split(".")[0];
  } catch {
    hostname = `dealer_${i}`;
  }
  const adapter = g.adapters.includes("dealer_spike")
    ? "dealer_spike"
    : g.adapters.includes("listivo")
      ? "listivo"
      : "woocommerce";
  return {
    id: hostname,
    adapter,
    baseUrl: g.base,
    priority: adapter === "dealer_spike" ? i + 1 : i + 20,
    label: hostname
  };
});
console.log(JSON.stringify(entries, null, 2));
