/**
 * Print sample inventory Product JSON-LD for Rich Results Test validation.
 * Usage: node scripts/sample-inventory-jsonld.mjs
 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import { fetchPublicInventoryUnits } from "./lib/fetch-public-inventory.mjs";
import {
  buildInventoryProductJsonLd,
  inventoryPublicListPriceCad,
  inventoryPublicPriceLabel
} from "./lib/inventory-seo.mjs";
import { loadViteBuildEnv } from "./lib/read-vite-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const { siteUrl, supabaseUrl, supabaseAnonKey } = loadViteBuildEnv(root);
const origin = siteUrl || "https://temptmotorsports.com";

/** Legacy invalid Product (no offers / aggregateRating / review). */
function buildLegacyInvalidProductJsonLd(row, { supabaseUrl: sbUrl }) {
  const url = `${origin}/inventory/${row.id}`;
  const title = `${row.make} ${row.model}`.trim().toLocaleUpperCase("en-CA");
  const image = row.photo_paths?.[0]
    ? `${sbUrl.replace(/\/+$/, "")}/storage/v1/object/public/inventory-photos/${encodeURIComponent(row.photo_paths[0])}`
    : null;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${row.year} ${title}`,
    description: `${row.year} ${title}. ${row.status}. ${inventoryPublicPriceLabel(row)}.`,
    url,
    sku: row.stock_number,
    category: row.category,
    brand: { "@type": "Brand", name: row.make },
    ...(image ? { image: [image] } : {}),
    additionalProperty: [
      { "@type": "PropertyValue", name: "Listing price", value: inventoryPublicPriceLabel(row) }
    ]
  };
}

function printSection(title, payload) {
  console.log(`\n=== ${title} ===\n`);
  if (payload == null) {
    console.log("(no Product JSON-LD — script tag omitted on live page)\n");
    return;
  }
  console.log(JSON.stringify(payload, null, 2));
  console.log("");
}

const { rows, error } = await fetchPublicInventoryUnits({ supabaseUrl, supabaseAnonKey });

if (error) {
  console.error(`[sample-inventory-jsonld] Could not fetch inventory (${error}).`);
  process.exit(1);
}

const priced = rows.find((row) => row.status !== "Sold" && inventoryPublicListPriceCad(row) != null);
const unpriced = rows.find((row) => row.status !== "Sold" && inventoryPublicListPriceCad(row) == null);

console.log(`[sample-inventory-jsonld] ${rows.length} public unit(s); origin=${origin}`);

if (unpriced) {
  printSection(
    `BEFORE (invalid) — call-for-price unit ${unpriced.year} ${unpriced.make} ${unpriced.model} (${unpriced.id})`,
    buildLegacyInvalidProductJsonLd(unpriced, { supabaseUrl })
  );
  printSection(
    `AFTER — same unit (Product JSON-LD omitted)`,
    buildInventoryProductJsonLd(unpriced, { siteOrigin: origin, supabaseUrl })
  );
} else {
  console.warn("[sample-inventory-jsonld] No call-for-price unit found in public inventory.");
}

if (priced) {
  printSection(
    `AFTER (valid) — priced unit ${priced.year} ${priced.make} ${priced.model} (${priced.id})`,
    buildInventoryProductJsonLd(priced, { siteOrigin: origin, supabaseUrl })
  );
} else {
  console.warn("[sample-inventory-jsonld] No priced unit found — add list_price_cad in admin to test Product rich results.");
}

console.log("Paste JSON blocks into https://search.google.com/test/rich-results (Code snippet tab).");
