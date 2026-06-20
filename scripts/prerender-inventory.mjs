import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchPublicInventoryUnits } from "./lib/fetch-public-inventory.mjs";
import {
  buildInventoryItemListJsonLd,
  buildInventoryProductJsonLd,
  INVENTORY_CALL_FOR_PRICING,
  inventoryMakeModelTitle,
  inventoryUnitSeoDescription,
  inventoryUnitSeoTitle,
  inventoryYearKmLine
} from "./lib/inventory-seo.mjs";
import { loadViteBuildEnv } from "./lib/read-vite-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const distDir = path.join(root, "dist");
const indexPath = path.join(distDir, "index.html");

const { siteUrl, supabaseUrl, supabaseAnonKey } = loadViteBuildEnv(root);

if (!fs.existsSync(indexPath)) {
  console.warn("[prerender-inventory] dist/index.html missing — skip prerender (run after vite build).");
  process.exit(0);
}

if (!siteUrl) {
  console.warn("[prerender-inventory] VITE_PUBLIC_SITE_URL not set — skip prerender.");
  process.exit(0);
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("[prerender-inventory] Supabase env not set — skip prerender.");
  process.exit(0);
}

const shellHtml = fs.readFileSync(indexPath, "utf8");
const { rows, error } = await fetchPublicInventoryUnits({ supabaseUrl, supabaseAnonKey });

if (error) {
  console.warn(`[prerender-inventory] Could not fetch inventory (${error}).`);
  process.exit(0);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Replace or inject tags in built index.html shell for a prerendered route.
 */
function buildPrerenderedHtml({
  title,
  description,
  canonicalPath,
  jsonLdObjects,
  bodyHtml,
  robots = "index, follow"
}) {
  const fullTitle = title.includes("Temptation Motorsports")
    ? title
    : `${title} | Temptation Motorsports`;
  const canonical = `${siteUrl}${canonicalPath}`;
  const jsonLdScripts = jsonLdObjects
    .map((obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`)
    .join("\n    ");

  let html = shellHtml;
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(fullTitle)}</title>`);
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${escapeHtml(description)}" />`
  );
  html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/i, "");

  const headInject = `
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(fullTitle)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta name="robots" content="${escapeHtml(robots)}" />
    ${jsonLdScripts}`;

  html = html.replace(/<\/head>/i, `${headInject}\n  </head>`);

  const prerenderMain = `<main class="inventory-prerender" id="inventory-prerender-fallback">${bodyHtml}</main>`;
  html = html.replace(
    /<div id="root"><\/div>/i,
    `<div id="root">${prerenderMain}</div>`
  );

  return html;
}

function unitDetailBody(row) {
  const title = inventoryMakeModelTitle(row);
  const path = `/inventory/${row.id}`;
  return `
    <p><a href="/inventory">← Inventory</a></p>
    <article>
      <p>${escapeHtml(row.category)} · ${escapeHtml(row.status)}</p>
      <h1>${escapeHtml(`${row.year} ${title}`)}</h1>
      <p>${escapeHtml(inventoryYearKmLine(row))}</p>
      <p class="inventory-prerenderPrice"><strong>${escapeHtml(INVENTORY_CALL_FOR_PRICING)}</strong></p>
      <p>Stock #${escapeHtml(row.stock_number)}</p>
      <p><a href="${escapeHtml(path)}">View full listing</a></p>
    </article>`;
}

function inventoryListBody(rows) {
  const items = rows
    .map((row) => {
      const title = inventoryMakeModelTitle(row);
      const href = `/inventory/${row.id}`;
      return `<li><a href="${escapeHtml(href)}">${escapeHtml(`${row.year} ${title}`)}</a> — ${escapeHtml(row.status)} · ${escapeHtml(INVENTORY_CALL_FOR_PRICING)}</li>`;
    })
    .join("\n");
  return `
    <h1>Inventory</h1>
    <p>${rows.length} unit${rows.length === 1 ? "" : "s"} at Temptation Motorsports. ${escapeHtml(INVENTORY_CALL_FOR_PRICING)} on all listings.</p>
    <ul>${items}</ul>`;
}

const indexableRows = rows.filter((row) => row.status !== "Sold");

let written = 0;

for (const row of indexableRows) {
  const canonicalPath = `/inventory/${row.id}`;
  const title = inventoryUnitSeoTitle(row);
  const description = inventoryUnitSeoDescription(row);
  const productLd = buildInventoryProductJsonLd(row, { siteOrigin: siteUrl, supabaseUrl });
  const html = buildPrerenderedHtml({
    title,
    description,
    canonicalPath,
    jsonLdObjects: [productLd],
    bodyHtml: unitDetailBody(row)
  });

  const outDir = path.join(distDir, "inventory", row.id);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");
  written += 1;
}

const listLd = buildInventoryItemListJsonLd(indexableRows, { siteOrigin: siteUrl, supabaseUrl });
const listHtml = buildPrerenderedHtml({
  title: "Inventory",
  description:
    "Browse motorcycles, ATVs, snowmobiles, side-by-sides, watercraft, and trailers. Call for pricing. Financing through Temptation Motorsports, Edmonton.",
  canonicalPath: "/inventory",
  jsonLdObjects: [listLd],
  bodyHtml: inventoryListBody(indexableRows)
});

const listDir = path.join(distDir, "inventory");
fs.mkdirSync(listDir, { recursive: true });
fs.writeFileSync(path.join(listDir, "index.html"), listHtml, "utf8");
written += 1;

console.log(`[prerender-inventory] wrote ${written} HTML file(s) under dist/inventory/`);
