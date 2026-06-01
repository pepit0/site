/**
 * Probe RideNow / Dealer Spike for used inventory access patterns.
 * Usage: node scripts/probe-ridenow-used.mjs
 */

const BASE = "https://www.ridenow.com";

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { Accept: "text/html,application/json,*/*", "User-Agent": "TemptationMotorsportsImport/1.0" },
    redirect: "follow"
  });
  return { status: res.status, text: await res.text(), ct: res.headers.get("content-type") ?? "" };
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json,*/*", "User-Agent": "TemptationMotorsportsImport/1.0" },
    redirect: "follow"
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const OID_RE = /oid(?:=|%3D|%26#x3D;|&#x3D;)(\d+)/gi;

function extractOids(html) {
  const seen = new Set();
  const out = [];
  for (const m of html.matchAll(OID_RE)) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      out.push(m[1]);
    }
  }
  return out;
}

async function probeListUrls() {
  const candidates = [
    "/--Inventory?pg=1&sz=50&condition=USED",
    "/--Inventory?pg=1&sz=50&condition=Used",
    "/--Inventory?pg=1&sz=50&used=1",
    "/--Inventory?pg=1&sz=50&invcondition=Used",
    "/--Inventory?pg=1&sz=50&InvCondition=Used",
    "/--Inventory?pg=1&sz=50&show=used",
    "/--Inventory?pg=1&sz=50&newused=used",
    "/--Inventory?pg=1&sz=50&NewUsed=Used",
    "/--Inventory?pg=1&sz=50&condition=Pre-Owned",
    "/--Inventory?pg=1&sz=50",
    "/used-inventory",
    "/pre-owned-inventory",
    "/--Inventory?pg=1&sz=50&vtype=ATV&used=1"
  ];
  console.log("\n=== List URL probes ===");
  for (const path of candidates) {
    const { status, text } = await fetchText(`${BASE}${path}`);
    const oids = extractOids(text);
    console.log(`${path} -> ${status}, len=${text.length}, oids=${oids.length}`);
  }
}

async function probeJsonEndpoints() {
  const candidates = [
    "/--xInventoryListing?pg=1&sz=50&format=json",
    "/--xInventoryListing?pg=1&sz=50&condition=USED&format=json",
    "/--xInventorySearch?pg=1&sz=50&format=json",
    "/--xInventorySearch?pg=1&sz=50&condition=USED&format=json",
    "/--xInventory?pg=1&sz=50&format=json",
    "/--xInventory?pg=1&sz=50&condition=USED&format=json",
    "/api/inventory?pg=1&sz=50",
    "/inventory.json?pg=1&sz=50"
  ];
  console.log("\n=== JSON endpoint probes ===");
  for (const path of candidates) {
    try {
      const { status, text, ct } = await fetchText(`${BASE}${path}`);
      const preview = text.slice(0, 120).replace(/\s+/g, " ");
      console.log(`${path} -> ${status} ct=${ct} preview=${preview}`);
    } catch (e) {
      console.log(`${path} -> ERR ${e.message}`);
    }
  }
}

async function scanConditions(maxPages = 3, maxPerPage = 15) {
  console.log("\n=== Condition scan (unfiltered list) ===");
  const condCounts = {};
  let usedWith5 = 0;
  for (let page = 1; page <= maxPages; page++) {
    const { text } = await fetchText(`${BASE}/--Inventory?pg=${page}&sz=50`);
    const oids = extractOids(text).slice(0, maxPerPage);
    if (!oids.length) break;
    for (const oid of oids) {
      try {
        const data = await fetchJson(`${BASE}/--xInventoryDetail?oid=${oid}&format=json`);
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) continue;
        const cond = String(row.condition ?? "UNKNOWN").toUpperCase();
        condCounts[cond] = (condCounts[cond] ?? 0) + 1;
        const photos = Array.isArray(row.aImages) ? row.aImages.length : 0;
        if (cond === "USED" && photos >= 5) {
          usedWith5++;
          console.log("  USED+5:", oid, row.year, row.make, row.model, row.category, photos);
        }
      } catch {
        /* skip */
      }
    }
  }
  console.log("conditions:", condCounts, "usedWith5:", usedWith5);
}

async function inspectUsedPageHtml() {
  const { text } = await fetchText(`${BASE}/--Inventory?pg=1&sz=50&condition=USED`);
  console.log("\n=== condition=USED page snippet ===");
  console.log(text.slice(0, 2000).replace(/\s+/g, " "));
  const formParams = [...text.matchAll(/name=\"([^\"]+)\"[^>]*value=\"([^\"]*)\"/gi)].slice(0, 20);
  console.log("form params:", formParams.map((m) => `${m[1]}=${m[2]}`));
}

await probeListUrls();
await probeJsonEndpoints();
await inspectUsedPageHtml();
await scanConditions(5, 20);
