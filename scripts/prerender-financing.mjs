import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPublicBusinessProfile } from "./lib/business-public.mjs";
import {
  buildFinancialServiceJsonLd,
  FINANCING_PRERENDER_PAGES
} from "./lib/financing-seo.mjs";
import { buildPrerenderedHtml, escapeHtml } from "./lib/prerender-html.mjs";
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
const profile = loadPublicBusinessProfile(root);

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
      <p>
        <a href="/apply">Apply for financing</a> ·
        <a href="/inventory">Browse inventory</a> ·
        <a href="/payment-calculator">Payment calculator</a> ·
        <a href="/faq">FAQ</a>
      </p>
      ${topicLinks ? `<h2>More financing topics</h2><ul>${topicLinks}</ul>` : ""}
    </article>`;
}

let written = 0;

for (const page of FINANCING_PRERENDER_PAGES) {
  const serviceLd = buildFinancialServiceJsonLd({
    serviceName: page.serviceName,
    description: page.description,
    siteOrigin: siteUrl,
    path: page.path,
    phoneTel: profile.phoneTel
  });

  const html = buildPrerenderedHtml(shellHtml, {
    siteUrl,
    title: page.title,
    description: page.description,
    canonicalPath: page.path,
    jsonLdObjects: [serviceLd],
    bodyHtml: financingBody(page),
    mainClass: "inventory-prerender financing-prerender",
    mainId: "financing-prerender-fallback"
  });

  const segments = page.path.replace(/^\//, "").split("/");
  const outDir = path.join(distDir, ...segments);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");
  written += 1;
}

console.log(`[prerender-financing] wrote ${written} HTML file(s) under dist/financing/`);
