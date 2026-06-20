import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildFaqPageJsonLd,
  CONVERSION_PRERENDER_PAGES,
  FAQ_PRERENDER_ITEMS
} from "./lib/conversion-seo.mjs";
import { loadPublicBusinessProfile } from "./lib/business-public.mjs";
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

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPrerenderedHtml({ title, description, canonicalPath, jsonLdObjects, bodyHtml, robots = "index, follow" }) {
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

  const prerenderMain = `<main class="inventory-prerender conversion-prerender" id="conversion-prerender-fallback">${bodyHtml}</main>`;
  html = html.replace(/<div id="root"><\/div>/i, `<div id="root">${prerenderMain}</div>`);

  return html;
}

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

  return `
    <article>
      <h1>${escapeHtml(page.h1)}</h1>
      <p>${escapeHtml(page.intro)}</p>
      ${extra}
      ${cta}
      <p>Phone: <a href="tel:${escapeHtml(profile.phoneTel)}">${escapeHtml(profile.phoneDisplay)}</a></p>
    </article>`;
}

let written = 0;

for (const page of CONVERSION_PRERENDER_PAGES) {
  const jsonLdObjects = page.path === "/faq" ? [buildFaqPageJsonLd(FAQ_PRERENDER_ITEMS)] : [];
  const html = buildPrerenderedHtml({
    title: page.title,
    description: page.description,
    canonicalPath: page.path,
    jsonLdObjects,
    bodyHtml: conversionBody(page)
  });

  const segments = page.path.split("/").filter(Boolean);
  const outDir = path.join(distDir, ...segments);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");
  written += 1;
}

console.log(`[prerender-conversion] wrote ${written} HTML file(s) for conversion/FAQ routes`);
