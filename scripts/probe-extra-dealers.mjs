/**
 * Probe candidate US powersports dealers (Dealer Spike + DX1).
 */
const CANDIDATES = [
  "https://www.magnummotorsports.com",
  "https://www.extremepowersports.com",
  "https://www.northcountrypowersports.com",
  "https://www.superiorpowersports.com",
  "https://www.royalpowersports.com",
  "https://www.powersportsplus.com",
  "https://www.ironcitycycle.com",
  "https://www.motoworldofwestlake.com",
  "https://www.ridecenterusa.com",
  "https://www.sportsmanscycle.com",
  "https://www.lynxpowersports.com",
  "https://www.ski-doo-dealer.com",
  "https://www.seadoo-dealer.com",
  "https://www.bertschpowersports.com",
  "https://www.cyclecityhonolulu.com",
  "https://www.pgatmotorsports.com",
  "https://www.sunenterprises.com",
  "https://www.vforcemarine.com",
  "https://www.pompspowersports.com",
  "https://www.ultimatecycle.com"
];

const OID_RE = /oid(?:=|%3D|%26#x3D;|&#x3D;)(\d+)/gi;

async function probeDealerSpike(base) {
  for (const cond of ["pre-owned", "Pre-Owned", "Used", "USED"]) {
    for (const path of ["/--inventory", "/--Inventory"]) {
      try {
        const url = `${base}${path}?pg=1&sz=50&condition=${encodeURIComponent(cond)}`;
        const res = await fetch(url, { headers: { "User-Agent": "TemptationMotorsportsImport/1.0" } });
        const html = await res.text();
        const oids = [...new Set([...html.matchAll(OID_RE)].map((m) => m[1]))];
        if (oids.length > 0) return { type: "dealer_spike", oids: oids.length, cond, path };
      } catch {
        /* skip */
      }
    }
  }
  return null;
}

async function probeDx1(base) {
  for (const listPath of ["/Inventory/Used-Inventory", "/inventory/used-inventory"]) {
    try {
      const res = await fetch(`${base}${listPath}`, { headers: { "User-Agent": "TemptationMotorsportsImport/1.0" } });
      const html = await res.text();
      if (!html.includes("Dx1ShowroomAlgolia") && !html.includes("algolia")) continue;
      const appId = (html.match(/applicationId['":\s]+['"]([^'"]+)/i) || [])[1];
      const apiKey = (html.match(/apiKey['":\s]+['"]([^'"]+)/i) || [])[1];
      if (!appId || !apiKey) continue;
      const ar = await fetch(`https://${appId.toLowerCase()}-dsn.algolia.net/1/indexes/*/queries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Algolia-Application-Id": appId,
          "X-Algolia-API-Key": apiKey
        },
        body: JSON.stringify({
          requests: [{ indexName: "prod_WebSellable", params: "hitsPerPage=1&page=0&filters=Condition:Used" }]
        })
      });
      const nb = (await ar.json()).results?.[0]?.nbHits ?? 0;
      return { type: "dx1", used: nb, listPath, appId };
    } catch {
      /* skip */
    }
  }
  return null;
}

console.log("Probing dealers...\n");
const good = [];
for (const base of CANDIDATES) {
  const ds = await probeDealerSpike(base);
  const dx1 = ds ? null : await probeDx1(base);
  const hit = ds ?? dx1;
  if (hit) {
    console.log(`✓ ${base}`, hit);
    good.push({ base, ...hit });
  } else {
    console.log(`✗ ${base}`);
  }
}
console.log("\n=== Good ===");
console.log(JSON.stringify(good, null, 2));
