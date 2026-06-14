import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildOrganizationJsonLd, formatAddressLines, loadPublicBusinessProfile } from "./lib/business-public.mjs";
import { COMPANY_PRERENDER_PAGES } from "./lib/company-seo.mjs";
import { loadViteBuildEnv } from "./lib/read-vite-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const distDir = path.join(root, "dist");
const indexPath = path.join(distDir, "index.html");

const { siteUrl } = loadViteBuildEnv(root);

if (!fs.existsSync(indexPath)) {
  console.warn("[prerender-company] dist/index.html missing — skip prerender.");
  process.exit(0);
}

if (!siteUrl) {
  console.warn("[prerender-company] VITE_PUBLIC_SITE_URL not set — skip prerender.");
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

  const prerenderMain = `<main class="inventory-prerender company-prerender" id="company-prerender-fallback">${bodyHtml}</main>`;
  html = html.replace(/<div id="root"><\/div>/i, `<div id="root">${prerenderMain}</div>`);

  return html;
}

function companyBody(page) {
  const addressLines = formatAddressLines(profile)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("\n");

  return `
    <article>
      <h1>${escapeHtml(page.h1)}</h1>
      <p>${escapeHtml(page.intro)}</p>
      ${addressLines}
      <p>Phone: <a href="tel:${escapeHtml(profile.phoneTel)}">${escapeHtml(profile.phoneDisplay)}</a></p>
      <p>Email: <a href="mailto:${escapeHtml(profile.email)}">${escapeHtml(profile.email)}</a></p>
      <p><a href="/apply">Apply for financing</a></p>
    </article>`;
}

let written = 0;

for (const page of COMPANY_PRERENDER_PAGES) {
  const pageType = page.path === "/about" ? "AboutPage" : "ContactPage";
  const organization = buildOrganizationJsonLd(profile, {
    pageUrl: `${siteUrl}/`,
    description: page.description,
    types: ["Organization", "AutomotiveBusiness"]
  });

  const pageLd = {
    "@context": "https://schema.org",
    "@type": pageType,
    name: page.title,
    description: page.description,
    url: `${siteUrl}${page.path}`,
    mainEntity: organization
  };

  const html = buildPrerenderedHtml({
    title: page.title,
    description: page.description,
    canonicalPath: page.path,
    jsonLdObjects: [pageLd],
    bodyHtml: companyBody(page)
  });

  const segments = page.path.replace(/^\//, "").split("/");
  const outDir = path.join(distDir, ...segments);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");
  written += 1;
}

console.log(`[prerender-company] wrote ${written} HTML file(s) under dist/about/ and dist/contact/`);
