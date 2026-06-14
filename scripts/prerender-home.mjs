import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildOrganizationJsonLd, loadPublicBusinessProfile } from "./lib/business-public.mjs";
import { buildFinancialServiceJsonLd } from "./lib/financing-seo.mjs";
import { HOME_FINANCING_LINKS, HOME_PRERENDER, buildWebSiteJsonLd } from "./lib/home-seo.mjs";
import { loadViteBuildEnv } from "./lib/read-vite-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const distDir = path.join(root, "dist");
const indexPath = path.join(distDir, "index.html");

const { siteUrl } = loadViteBuildEnv(root);

if (!fs.existsSync(indexPath)) {
  console.warn("[prerender-home] dist/index.html missing — skip prerender.");
  process.exit(0);
}

if (!siteUrl) {
  console.warn("[prerender-home] VITE_PUBLIC_SITE_URL not set — skip prerender.");
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

function homeBody() {
  const topicLinks = HOME_FINANCING_LINKS.map(
    (link) => `<li><a href="${escapeHtml(link.path)}">${escapeHtml(link.label)}</a></li>`
  ).join("\n");

  return `
    <article>
      <h1>${escapeHtml(HOME_PRERENDER.h1)}</h1>
      <p>${escapeHtml(HOME_PRERENDER.intro)}</p>
      <p>${escapeHtml(HOME_PRERENDER.subIntro)}</p>
      <p>
        <a href="/financing">Powersports and motorsports financing</a> ·
        <a href="/apply">Apply free online</a> ·
        <a href="/inventory">Browse inventory</a> ·
        <a href="/contact">Contact us</a>
      </p>
      <h2>Popular financing topics</h2>
      <ul>${topicLinks}</ul>
      <p>Phone: <a href="tel:${escapeHtml(profile.phoneTel)}">${escapeHtml(profile.phoneDisplay)}</a></p>
    </article>`;
}

function buildPrerenderedHtml({ title, description, jsonLdObjects, bodyHtml }) {
  const fullTitle = title.includes("Temptation Motorsports")
    ? title
    : `${title} | Temptation Motorsports`;
  const canonical = siteUrl;

  let html = shellHtml;
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(fullTitle)}</title>`);
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${escapeHtml(description)}" />`
  );
  html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${escapeHtml(canonical)}" />`);

  const jsonLdScripts = jsonLdObjects
    .map((obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`)
    .join("\n    ");

  const headInject = `
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(fullTitle)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta name="robots" content="index, follow" />
    ${jsonLdScripts}`;

  html = html.replace(/<\/head>/i, `${headInject}\n  </head>`);

  const prerenderMain = `<main class="inventory-prerender home-prerender" id="home-prerender-fallback">${bodyHtml}</main>`;
  html = html.replace(/<div id="root"><\/div>/i, `<div id="root">${prerenderMain}</div>`);

  return html;
}

const organizationLd = buildOrganizationJsonLd(profile, {
  pageUrl: siteUrl,
  description: HOME_PRERENDER.description,
  types: ["LocalBusiness", "AutomotiveBusiness", "FinancialService"]
});

const financialServiceLd = buildFinancialServiceJsonLd({
  serviceName: "Powersports and motorsports financing",
  description: HOME_PRERENDER.description,
  siteOrigin: siteUrl,
  path: "/financing"
});

const webSiteLd = buildWebSiteJsonLd({
  siteOrigin: siteUrl,
  description: HOME_PRERENDER.description
});

const html = buildPrerenderedHtml({
  title: HOME_PRERENDER.title,
  description: HOME_PRERENDER.description,
  jsonLdObjects: [webSiteLd, organizationLd, financialServiceLd],
  bodyHtml: homeBody()
});

fs.writeFileSync(indexPath, html, "utf8");
console.log("[prerender-home] wrote dist/index.html with homepage SEO fallback");
