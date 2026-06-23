import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildOrganizationJsonLd, loadPublicBusinessProfile } from "./lib/business-public.mjs";
import { buildFinancialServiceJsonLd } from "./lib/financing-seo.mjs";
import { HOME_FINANCING_LINKS, HOME_PRERENDER, buildWebSiteJsonLd } from "./lib/home-seo.mjs";
import { buildPrerenderedHtml, escapeHtml, absoluteInternalUrl } from "./lib/prerender-html.mjs";
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
const abs = (path) => absoluteInternalUrl(siteUrl, path);

function homeBody() {
  const topicLinks = HOME_FINANCING_LINKS.map(
    (link) => `<li><a href="${escapeHtml(abs(link.path))}">${escapeHtml(link.label)}</a></li>`
  ).join("\n");

  return `
    <article>
      <h1>${escapeHtml(HOME_PRERENDER.h1)}</h1>
      <p>${escapeHtml(HOME_PRERENDER.intro)}</p>
      <p>${escapeHtml(HOME_PRERENDER.subIntro)}</p>
      <p>
        <a href="${escapeHtml(abs("/financing"))}">Powersports and motorsports financing</a> ·
        <a href="${escapeHtml(abs("/apply"))}">Apply free online</a> ·
        <a href="${escapeHtml(abs("/inventory"))}">Browse inventory</a> ·
        <a href="${escapeHtml(abs("/faq"))}">FAQ</a> ·
        <a href="${escapeHtml(abs("/reviews"))}">Reviews</a> ·
        <a href="${escapeHtml(abs("/payment-calculator"))}">Payment calculator</a> ·
        <a href="${escapeHtml(abs("/contact"))}">Contact us</a>
      </p>
      <h2>Popular financing topics</h2>
      <ul>${topicLinks}</ul>
      <p>Phone: <a href="tel:${escapeHtml(profile.phoneTel)}">${escapeHtml(profile.phoneDisplay)}</a></p>
    </article>`;
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
  path: "/financing",
  phoneTel: profile.phoneTel
});

const webSiteLd = buildWebSiteJsonLd({
  siteOrigin: siteUrl,
  description: HOME_PRERENDER.description
});

const html = buildPrerenderedHtml(shellHtml, {
  siteUrl,
  title: HOME_PRERENDER.title,
  description: HOME_PRERENDER.description,
  canonicalPath: "/",
  jsonLdObjects: [webSiteLd, organizationLd, financialServiceLd],
  bodyHtml: homeBody(),
  mainClass: "inventory-prerender home-prerender",
  mainId: "home-prerender-fallback"
});

fs.writeFileSync(indexPath, html, "utf8");
console.log("[prerender-home] wrote dist/index.html with homepage SEO fallback");
