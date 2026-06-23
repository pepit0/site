/** Shared prerender HTML injection (react-helmet-async dedupes tags marked data-rh="true"). */

import { formatSeoDocumentTitle } from "./seo-title.mjs";

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function absoluteInternalUrl(siteUrl, path) {
  const base = String(siteUrl).replace(/\/+$/, "");
  const loc = path.startsWith("/") ? path : `/${path}`;
  return `${base}${loc}`;
}

/**
 * @param {string} shellHtml Built dist/index.html
 * @param {{
 *   siteUrl: string;
 *   title: string;
 *   description: string;
 *   canonicalPath: string;
 *   jsonLdObjects?: Record<string, unknown>[];
 *   bodyHtml: string;
 *   robots?: string;
 *   rootClass?: string;
 *   mainClass?: string;
 *   mainId?: string;
 * }} options
 */
export function buildPrerenderedHtml(
  shellHtml,
  {
    siteUrl,
    title,
    description,
    canonicalPath,
    jsonLdObjects = [],
    bodyHtml,
    robots = "index, follow",
    rootClass = "",
    mainClass = "inventory-prerender",
    mainId = "inventory-prerender-fallback"
  }
) {
  const fullTitle = formatSeoDocumentTitle(title);
  const canonical = `${siteUrl}${canonicalPath}`;
  const rh = ' data-rh="true"';
  const jsonLdScripts = jsonLdObjects
    .map((obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`)
    .join("\n    ");

  let html = shellHtml;
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(fullTitle)}</title>`);
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${escapeHtml(description)}" />`
  );
  html = html.replace(/<link\s+rel="canonical"[^>]*\/?>/gi, "");

  const headInject = `
    <link rel="canonical" href="${escapeHtml(canonical)}"${rh} />
    <meta property="og:type" content="website"${rh} />
    <meta property="og:title" content="${escapeHtml(fullTitle)}"${rh} />
    <meta property="og:description" content="${escapeHtml(description)}"${rh} />
    <meta property="og:url" content="${escapeHtml(canonical)}"${rh} />
    <meta name="robots" content="${escapeHtml(robots)}"${rh} />
    ${jsonLdScripts}`;

  html = html.replace(/<\/head>/i, `${headInject}\n  </head>`);

  const rootAttr = rootClass ? ` class="${escapeHtml(rootClass)}"` : "";
  const prerenderMain = `<main class="${escapeHtml(mainClass)}" id="${escapeHtml(mainId)}" hidden aria-hidden="true">${bodyHtml}</main>`;
  html = html.replace(/<div id="root"><\/div>/i, `<div id="root"${rootAttr}></div>\n    ${prerenderMain}`);

  return html;
}
