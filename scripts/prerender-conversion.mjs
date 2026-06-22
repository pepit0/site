import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildFaqPageJsonLd,
  CONVERSION_PRERENDER_PAGES,
  FAQ_PRERENDER_ITEMS
} from "./lib/conversion-seo.mjs";
import { loadPublicBusinessProfile } from "./lib/business-public.mjs";
import { buildPrerenderedHtml, escapeHtml } from "./lib/prerender-html.mjs";
import { loadViteBuildEnv } from "./lib/read-vite-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const distDir = path.join(root, "dist");
const indexPath = path.join(distDir, "index.html");

const { siteUrl } = loadViteBuildEnv(root);

if (!fs.existsSync(indexPath)) {
  console.warn("[prerender-conversion] dist/index.html missing — skip prerender.");
  process.exit(0);
}

if (!siteUrl) {
  console.warn("[prerender-conversion] VITE_PUBLIC_SITE_URL not set — skip prerender.");
  process.exit(0);
}

const shellHtml = fs.readFileSync(indexPath, "utf8");
const profile = loadPublicBusinessProfile(root);

function conversionBody(page) {
  const cta =
    page.path === "/apply"
      ? `<p><a href="/apply">Apply for financing</a> · <a href="/inventory">Browse inventory</a></p>`
      : page.path.startsWith("/sell-your-ride")
        ? `<p><a href="/sell-your-ride/apply">Start sell form</a> · <a href="/sell-your-ride">How it works</a></p>`
        : `<p><a href="/apply">Apply for financing</a> · <a href="/contact">Contact us</a></p>`;

  let extra = "";
  if (page.path === "/faq") {
    const faqItems = FAQ_PRERENDER_ITEMS.map(
      (item) =>
        `<div><h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p></div>`
    ).join("\n");
    extra = `<section>${faqItems}</section>`;
  }
  const related =
    page.path === "/faq"
      ? `<p><a href="/financing">Financing guides</a> · <a href="/inventory">Inventory</a> · <a href="/payment-calculator">Payment calculator</a> · <a href="/reviews">Reviews</a> · <a href="/sell-your-ride">Sell your ride</a></p>`
      : page.path.startsWith("/sell-your-ride")
        ? `<p><a href="/inventory">Inventory</a> · <a href="/faq">FAQ</a> · <a href="/contact">Contact us</a></p>`
        : `<p><a href="/financing">Financing guides</a> · <a href="/faq">FAQ</a> · <a href="/payment-calculator">Payment calculator</a></p>`;

  return `
    <article>
      <h1>${escapeHtml(page.h1)}</h1>
      <p>${escapeHtml(page.intro)}</p>
      ${extra}
      ${related}
      ${cta}
      <p>Phone: <a href="tel:${escapeHtml(profile.phoneTel)}">${escapeHtml(profile.phoneDisplay)}</a></p>
    </article>`;
}

let written = 0;

for (const page of CONVERSION_PRERENDER_PAGES) {
  const jsonLdObjects = page.path === "/faq" ? [buildFaqPageJsonLd(FAQ_PRERENDER_ITEMS)] : [];
  const html = buildPrerenderedHtml(shellHtml, {
    siteUrl,
    title: page.title,
    description: page.description,
    canonicalPath: page.path,
    jsonLdObjects,
    bodyHtml: conversionBody(page),
    mainClass: "inventory-prerender conversion-prerender",
    mainId: "conversion-prerender-fallback"
  });

  const segments = page.path.split("/").filter(Boolean);
  const outDir = path.join(distDir, ...segments);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");
  written += 1;
}

console.log(`[prerender-conversion] wrote ${written} HTML file(s) for conversion/FAQ routes`);
