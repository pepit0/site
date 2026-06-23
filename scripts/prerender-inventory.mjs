import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchPublicInventoryUnits } from "./lib/fetch-public-inventory.mjs";
import {
  buildInventoryItemListJsonLd,
  buildInventoryProductJsonLd,
  buildInventoryUnitListingParagraphs,
  INVENTORY_CALL_FOR_PRICING,
  INVENTORY_PRERENDER_LIST_LIMIT,
  inventoryMakeModelTitle,
  inventoryUnitSeoDescription,
  inventoryUnitSeoDocumentTitle,
  inventoryYearKmLine,
  pickSimilarInventoryUnits,
  financingNavLabelForCategory,
  financingPathForCategory
} from "./lib/inventory-seo.mjs";
import { buildPrerenderedHtml, escapeHtml, absoluteInternalUrl } from "./lib/prerender-html.mjs";
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

const VEHICLE_CATEGORIES = ["Motorcycle", "ATV", "Snowmobile", "Side by side", "Watercraft", "Trailer"];
const abs = (path) => absoluteInternalUrl(siteUrl, path);

function inventoryCategoryHref(category) {
  return `/inventory?category=${encodeURIComponent(category)}`;
}

function inventoryCategoryBrowseLabel(category) {
  switch (category) {
    case "Motorcycle":
      return "Motorcycles for sale";
    case "ATV":
      return "ATVs for sale";
    case "Snowmobile":
      return "Snowmobiles for sale";
    case "Side by side":
      return "Side-by-sides for sale";
    case "Watercraft":
      return "Watercraft for sale";
    case "Trailer":
      return "Trailers for sale";
    default:
      return `${category} for sale`;
  }
}

function inventoryBrowseByTypeSection() {
  const items = VEHICLE_CATEGORIES.map(
    (category) =>
      `<li><a href="${escapeHtml(abs(inventoryCategoryHref(category)))}">${escapeHtml(inventoryCategoryBrowseLabel(category))}</a></li>`
  ).join("\n        ");
  return `
      <section aria-labelledby="prerender-browse-type-heading">
        <h2 id="prerender-browse-type-heading">Browse by type</h2>
        <ul>
        ${items}
        </ul>
      </section>`;
}

function unitDetailBody(row, allRows) {
  const title = inventoryMakeModelTitle(row);
  const path = `/inventory/${row.id}`;
  const listingParagraphs = buildInventoryUnitListingParagraphs(row)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("\n      ");
  const similarRows = pickSimilarInventoryUnits(row, allRows, 4);
  const similarItems = similarRows
    .map((similar) => {
      const similarTitle = inventoryMakeModelTitle(similar);
      const href = abs(`/inventory/${similar.id}`);
      return `<li><a href="${escapeHtml(href)}">${escapeHtml(`${similar.year} ${similarTitle}`)}</a></li>`;
    })
    .join("\n        ");
  const similarSection =
    similarRows.length > 0
      ? `
      <section aria-labelledby="prerender-similar-heading">
        <h2 id="prerender-similar-heading">You might also like</h2>
        <ul>
        ${similarItems}
        </ul>
        <p><a href="${escapeHtml(abs(inventoryCategoryHref(row.category)))}">${escapeHtml(inventoryCategoryBrowseLabel(row.category))}</a></p>
      </section>`
      : "";
  const financingPath = financingPathForCategory(row.category);
  const financingLabel = financingNavLabelForCategory(row.category);
  return `
    <p><a href="${escapeHtml(abs("/inventory"))}">← Inventory</a> · <a href="${escapeHtml(abs(inventoryCategoryHref(row.category)))}">${escapeHtml(row.category)}</a></p>
    <article>
      <p>${escapeHtml(row.category)} · ${escapeHtml(row.status)}</p>
      <h1>${escapeHtml(`${row.year} ${title}`)}</h1>
      <p>${escapeHtml(inventoryYearKmLine(row))}</p>
      <p class="inventory-prerenderPrice"><strong>${escapeHtml(INVENTORY_CALL_FOR_PRICING)}</strong></p>
      <p>Stock #${escapeHtml(row.stock_number)}</p>
      <section aria-labelledby="prerender-listing-heading">
        <h2 id="prerender-listing-heading">About this ride</h2>
        ${listingParagraphs}
      </section>
      <p>
        <a href="${escapeHtml(abs(financingPath))}">${escapeHtml(financingLabel)}</a> ·
        <a href="${escapeHtml(abs("/financing"))}">All financing guides</a> ·
        <a href="${escapeHtml(abs("/payment-calculator"))}">Payment calculator</a> ·
        <a href="${escapeHtml(abs("/faq"))}">FAQ</a> ·
        <a href="${escapeHtml(abs("/reviews"))}">Reviews</a> ·
        <a href="${escapeHtml(abs("/about"))}">About us</a> ·
        <a href="${escapeHtml(abs("/contact"))}">Contact</a>
      </p>
      <p><a href="${escapeHtml(abs(path))}">View full listing</a></p>
      ${similarSection}
      ${inventoryBrowseByTypeSection()}
    </article>`;
}

function inventoryListBody(allRows, displayRows) {
  const items = displayRows
    .map((row) => {
      const title = inventoryMakeModelTitle(row);
      const href = abs(`/inventory/${row.id}`);
      return `<li><a href="${escapeHtml(href)}">${escapeHtml(`${row.year} ${title}`)}</a> — ${escapeHtml(row.status)} · ${escapeHtml(INVENTORY_CALL_FOR_PRICING)}</li>`;
    })
    .join("\n");
  const overflowNote =
    allRows.length > displayRows.length
      ? `<p>Showing ${displayRows.length} of ${allRows.length} units. Open the full inventory page for filters and search.</p>`
      : "";
  return `
    <h1>Inventory</h1>
    <p>${allRows.length} unit${allRows.length === 1 ? "" : "s"} at Temptation Motorsports. ${escapeHtml(INVENTORY_CALL_FOR_PRICING)} on all listings.</p>
    <p>
      <a href="${escapeHtml(abs("/financing"))}">Financing guides</a> ·
      <a href="${escapeHtml(abs("/faq"))}">FAQ</a> ·
      <a href="${escapeHtml(abs("/payment-calculator"))}">Payment calculator</a> ·
      <a href="${escapeHtml(abs("/reviews"))}">Reviews</a> ·
      <a href="${escapeHtml(abs("/apply"))}">Apply for financing</a>
    </p>
    ${overflowNote}
    <ul>${items}</ul>
    ${inventoryBrowseByTypeSection()}`;
}

function renderPage(options) {
  return buildPrerenderedHtml(shellHtml, { siteUrl, ...options });
}

const indexableRows = rows.filter((row) => row.status !== "Sold");
const listPreviewRows = indexableRows.slice(0, INVENTORY_PRERENDER_LIST_LIMIT);

let written = 0;

for (const row of indexableRows) {
  const canonicalPath = `/inventory/${row.id}`;
  const title = inventoryUnitSeoDocumentTitle(row);
  const description = inventoryUnitSeoDescription(row);
  const productLd = buildInventoryProductJsonLd(row, { siteOrigin: siteUrl, supabaseUrl });
  const html = renderPage({
    title,
    description,
    canonicalPath,
    jsonLdObjects: productLd ? [productLd] : [],
    bodyHtml: unitDetailBody(row, rows)
  });

  const outDir = path.join(distDir, "inventory", row.id);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");
  written += 1;
}

const listLd = buildInventoryItemListJsonLd(indexableRows, { siteOrigin: siteUrl });
const listHtml = renderPage({
  title: "Rides for sale",
  description:
    "Browse motorcycles, ATVs, snowmobiles, side-by-sides, watercraft, and trailers. Call for pricing. Financing through Temptation Motorsports, Edmonton.",
  canonicalPath: "/inventory",
  jsonLdObjects: listLd ? [listLd] : [],
  bodyHtml: inventoryListBody(indexableRows, listPreviewRows)
});

const listDir = path.join(distDir, "inventory");
fs.mkdirSync(listDir, { recursive: true });
fs.writeFileSync(path.join(listDir, "index.html"), listHtml, "utf8");
written += 1;

console.log(`[prerender-inventory] wrote ${written} HTML file(s) under dist/inventory/`);
