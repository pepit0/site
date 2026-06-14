import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildFinancialServiceJsonLd,
  FINANCING_PRERENDER_PAGES
} from "./lib/financing-seo.mjs";
import { loadViteBuildEnv } from "./lib/read-vite-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const distDir = path.join(root, "dist");
const indexPath = path.join(distDir, "index.html");

const { siteUrl } = loadViteBuildEnv(root);

if (!fs.existsSync(indexPath)) {
  console.warn("[prerender-financing] dist/index.html missing — skip prerender.");
  process.exit(0);
}

if (!siteUrl) {
  console.warn("[prerender-financing] VITE_PUBLIC_SITE_URL not set — skip prerender.");
  process.exit(0);
}

const shellHtml = fs.readFileSync(indexPath, "utf8");

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPrerenderedHtml({ title, description, canonicalPath, jsonLdObjects, bodyHtml }) {
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

  const headInject = `
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(fullTitle)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta name="robots" content="index, follow" />
    ${jsonLdScripts}`;

  html = html.replace(/<\/head>/i, `${headInject}\n  </head>`);

  const prerenderMain = `<main class="inventory-prerender financing-prerender" id="financing-prerender-fallback">${bodyHtml}</main>`;
  html = html.replace(/<div id="root"><\/div>/i, `<div id="root">${prerenderMain}</div>`);

  return html;
}

function financingBody(page) {
  const topicLinks = FINANCING_PRERENDER_PAGES.filter((p) => p.path !== page.path && p.path !== "/financing")
    .map(
      (p) =>
        `<li><a href="${escapeHtml(p.path)}">${escapeHtml(p.title.split("—")[0].trim())}</a></li>`
    )
    .join("\n");

  return `
    <p><a href="/">Home</a> · <a href="/financing">Financing</a></p>
    <article>
      <h1>${escapeHtml(page.h1)}</h1>
      <p class="financing-directAnswer">${escapeHtml(page.intro)}</p>
      <p><a href="/apply">Apply for financing</a> · <a href="/inventory">Browse inventory</a></p>
      ${topicLinks ? `<h2>More financing topics</h2><ul>${topicLinks}</ul>` : ""}
    </article>`;
}

let written = 0;

for (const page of FINANCING_PRERENDER_PAGES) {
  const serviceLd = buildFinancialServiceJsonLd({
    serviceName: page.serviceName,
    description: page.description,
    siteOrigin: siteUrl,
    path: page.path
  });

  const html = buildPrerenderedHtml({
    title: page.title,
    description: page.description,
    canonicalPath: page.path,
    jsonLdObjects: [serviceLd],
    bodyHtml: financingBody(page)
  });

  const segments = page.path.replace(/^\//, "").split("/");
  const outDir = path.join(distDir, ...segments);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");
  written += 1;
}

console.log(`[prerender-financing] wrote ${written} HTML file(s) under dist/financing/`);
