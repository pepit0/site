/**
 * Probe candidate US dealer domains for public inventory APIs.
 *
 * Usage: npm run us:discover-dealers
 * Optional: node scripts/discover-us-dealer-apis.mjs https://example-dealer.com ...
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const DEFAULT_CANDIDATES = [
  "https://www.ridenow.com",
  "https://www.foxpowersports.com",
  "https://www.heartlandhonda.com",
  "https://www.hondaws.com"
];

const PROBES = [
  { key: "woocommerce", path: "/wp-json/wc/store/v1/products?per_page=1" },
  { key: "listivo", path: "/wp-json/wp/v2/listings?per_page=1" },
  { key: "inventory_presser", path: "/wp-json/wp/v2/inventory_vehicle?per_page=1" },
  { key: "dealer_spike_detail", path: "/--xInventoryDetail?oid=1&format=json" }
];

function normalizeBase(raw) {
  let u = raw.trim().replace(/\/+$/, "");
  if (!u.startsWith("http")) u = `https://${u}`;
  return u;
}

async function probeOne(baseUrl, probe) {
  const url = `${baseUrl}${probe.path}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json, text/html, */*", "User-Agent": "TemptationMotorsportsImport/1.0" },
      redirect: "follow"
    });
    const ct = res.headers.get("Content-Type") ?? "";
    const text = await res.text();
    const isJson = ct.includes("json") || text.trimStart().startsWith("[") || text.trimStart().startsWith("{");
    const dealerSpikeOk = probe.key === "dealer_spike_detail" && isJson && text.includes('"Specifications"');
    const wooOk = probe.key === "woocommerce" && res.ok && isJson && text.includes('"id"');
    const listivoOk = probe.key === "listivo" && res.ok && isJson && !text.includes("rest_no_route");
    const invpOk = probe.key === "inventory_presser" && res.ok && isJson && !text.includes("rest_no_route");
    const ok =
      probe.key === "dealer_spike_detail"
        ? dealerSpikeOk
        : probe.key === "woocommerce"
          ? wooOk
          : probe.key === "listivo"
            ? listivoOk
            : invpOk;
    return { ok, status: res.status, sample: text.slice(0, 120).replace(/\s+/g, " ") };
  } catch (e) {
    return { ok: false, status: 0, sample: e instanceof Error ? e.message : "fetch failed" };
  }
}

async function probeDomain(baseUrl) {
  const results = {};
  for (const p of PROBES) {
    results[p.key] = await probeOne(baseUrl, p);
  }
  const adapters = [];
  if (results.dealer_spike_detail?.ok) adapters.push("dealer_spike");
  if (results.woocommerce?.ok) adapters.push("woocommerce");
  if (results.listivo?.ok) adapters.push("listivo");
  if (results.inventory_presser?.ok) adapters.push("inventory_presser");
  return { baseUrl, results, adapters };
}

function loadRegistryPath() {
  return join(ROOT, "config", "us-import-sources.json");
}

function suggestRegistryEntry(report) {
  const adapter = report.adapters[0];
  if (!adapter) return null;
  let hostname;
  try {
    hostname = new URL(report.baseUrl).hostname.replace(/^www\./, "").split(".")[0];
  } catch {
    hostname = "dealer";
  }
  return {
    id: hostname,
    adapter,
    baseUrl: report.baseUrl,
    priority: 10,
    label: hostname
  };
}

const args = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const candidates = args.length > 0 ? args.map(normalizeBase) : DEFAULT_CANDIDATES;

console.log("US dealer API discovery\n");

const reports = [];
for (const base of candidates) {
  const report = await probeDomain(base);
  reports.push(report);
  console.log(`\n${base}`);
  for (const [key, r] of Object.entries(report.results)) {
    console.log(`  ${r.ok ? "✓" : "✗"} ${key} (${r.status}) ${r.sample}`);
  }
  if (report.adapters.length) {
    console.log(`  → adapters: ${report.adapters.join(", ")}`);
  } else {
    console.log("  → no supported adapters detected");
  }
}

const suggestions = reports.map(suggestRegistryEntry).filter(Boolean);
if (suggestions.length) {
  console.log("\nSuggested config/us-import-sources.json entries:");
  console.log(JSON.stringify(suggestions, null, 2));
}

const registryPath = loadRegistryPath();
if (existsSync(registryPath)) {
  console.log(`\nCurrent registry (${registryPath}):`);
  console.log(readFileSync(registryPath, "utf8"));
}
