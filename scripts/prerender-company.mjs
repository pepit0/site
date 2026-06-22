import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildOrganizationJsonLd, formatAddressLines, loadPublicBusinessProfile } from "./lib/business-public.mjs";
import { COMPANY_PRERENDER_PAGES } from "./lib/company-seo.mjs";
import {
  buildAggregateRatingJsonLd,
  buildReviewJsonLd,
  loadGoogleReviews
} from "./lib/google-reviews.mjs";
import { buildPrerenderedHtml, escapeHtml } from "./lib/prerender-html.mjs";
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
const googleReviews = loadGoogleReviews(root);

function companyBody(page) {
  const addressLines = formatAddressLines(profile)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("\n");

  if (page.path === "/reviews") {
    const reviewItems = googleReviews.reviews
      .slice(0, 8)
      .map(
        (review) =>
          `<li><strong>${escapeHtml(review.authorName)}</strong> — ${escapeHtml(review.rating)}/5: ${escapeHtml(review.text)}</li>`
      )
      .join("\n");

    return `
    <article>
      <h1>${escapeHtml(page.h1)}</h1>
      <p>${escapeHtml(page.intro)}</p>
      <p>${googleReviews.summary.ratingValue} out of 5 from ${googleReviews.summary.reviewCount} Google reviews.</p>
      <ul>${reviewItems}</ul>
      <p><a href="/financing">Financing guides</a> · <a href="/inventory">Inventory</a> · <a href="/faq">FAQ</a></p>
      <p><a href="/apply">Apply for financing</a></p>
    </article>`;
  }

  const relatedLinks =
    page.path === "/about"
      ? `<p><a href="/financing">Financing guides</a> · <a href="/reviews">Reviews</a> · <a href="/faq">FAQ</a> · <a href="/inventory">Inventory</a></p>`
      : page.path === "/contact"
        ? `<p><a href="/financing">Financing guides</a> · <a href="/faq">FAQ</a> · <a href="/inventory">Inventory</a></p>`
        : page.path === "/payment-calculator"
          ? `<p><a href="/financing">Financing guides</a> · <a href="/inventory">Inventory</a> · <a href="/apply">Apply for financing</a></p>`
          : "";

  return `
    <article>
      <h1>${escapeHtml(page.h1)}</h1>
      <p>${escapeHtml(page.intro)}</p>
      ${addressLines}
      ${relatedLinks}
      <p>Phone: <a href="tel:${escapeHtml(profile.phoneTel)}">${escapeHtml(profile.phoneDisplay)}</a></p>
      <p>Email: <a href="mailto:${escapeHtml(profile.email)}">${escapeHtml(profile.email)}</a></p>
      <p><a href="/apply">Apply for financing</a></p>
    </article>`;
}

let written = 0;

for (const page of COMPANY_PRERENDER_PAGES) {
  const pageType =
    page.path === "/about" ? "AboutPage" : page.path === "/contact" ? "ContactPage" : "WebPage";
  const organization = buildOrganizationJsonLd(profile, {
    pageUrl: `${siteUrl}/`,
    description: page.description,
    types:
      page.path === "/reviews"
        ? ["LocalBusiness", "AutomotiveBusiness", "FinancialService"]
        : ["Organization", "AutomotiveBusiness"]
  });

  let pageLd;
  if (page.path === "/reviews") {
    const pageUrl = `${siteUrl}${page.path}`;
    const orgId = `${pageUrl}#organization`;
    const { "@context": _ctx, ...orgBase } = organization;
    pageLd = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          name: page.title,
          description: page.description,
          url: pageUrl,
          mainEntity: { "@id": orgId }
        },
        {
          ...orgBase,
          "@id": orgId,
          aggregateRating: buildAggregateRatingJsonLd(googleReviews.summary),
          review: googleReviews.reviews.map(buildReviewJsonLd)
        }
      ]
    };
  } else {
    pageLd = {
      "@context": "https://schema.org",
      "@type": pageType,
      name: page.title,
      description: page.description,
      url: `${siteUrl}${page.path}`,
      mainEntity: organization
    };
  }

  const html = buildPrerenderedHtml(shellHtml, {
    siteUrl,
    title: page.title,
    description: page.description,
    canonicalPath: page.path,
    jsonLdObjects: [pageLd],
    bodyHtml: companyBody(page),
    mainClass: "inventory-prerender company-prerender",
    mainId: "company-prerender-fallback"
  });

  const segments = page.path.replace(/^\//, "").split("/");
  const outDir = path.join(distDir, ...segments);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");
  written += 1;
}

console.log(`[prerender-company] wrote ${written} HTML file(s) under dist/about/, dist/contact/, dist/payment-calculator/, and dist/reviews/`);
