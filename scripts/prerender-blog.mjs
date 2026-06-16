import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchPublicBlogPosts } from "./lib/fetch-public-blog.mjs";
import { BLOG_HUB_SEO, buildBlogPostingJsonLd } from "./lib/blog-seo.mjs";
import { loadViteBuildEnv } from "./lib/read-vite-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const distDir = path.join(root, "dist");
const indexPath = path.join(distDir, "index.html");

const { siteUrl, supabaseUrl, supabaseAnonKey } = loadViteBuildEnv(root);

if (!fs.existsSync(indexPath)) {
  console.warn("[prerender-blog] dist/index.html missing — skip prerender.");
  process.exit(0);
}

if (!siteUrl) {
  console.warn("[prerender-blog] VITE_PUBLIC_SITE_URL not set — skip prerender.");
  process.exit(0);
}

const { rows: blogPosts } = await fetchPublicBlogPosts({ supabaseUrl, supabaseAnonKey });

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

  const prerenderMain = `<main class="inventory-prerender blog-prerender" id="blog-prerender-fallback">${bodyHtml}</main>`;
  html = html.replace(/<div id="root"><\/div>/i, `<div id="root">${prerenderMain}</div>`);

  return html;
}

function blogHubBody(posts) {
  const links = posts
    .map(
      (post) =>
        `<li><a href="${escapeHtml(post.path)}">${escapeHtml(post.title)}</a> — ${escapeHtml(post.excerpt)}</li>`
    )
    .join("\n");

  return `
    <p><a href="/">Home</a> · Blog</p>
    <article>
      <h1>${escapeHtml(BLOG_HUB_SEO.h1)}</h1>
      <p>${escapeHtml(BLOG_HUB_SEO.tagline)}</p>
      <ul>${links}</ul>
    </article>`;
}

function blogPostBody(post) {
  const bodyContent = post.bodyHtml
    ? post.bodyHtml
    : post.body.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n");

  return `
    <p><a href="/">Home</a> · <a href="/blog">Blog</a></p>
    <article>
      <h1>${escapeHtml(post.title)}</h1>
      ${bodyContent}
      <p><a href="/apply">Apply for financing</a> · <a href="/blog">Back to blog</a></p>
    </article>`;
}

function writePage({ path: canonicalPath, title, description, jsonLdObjects, bodyHtml }) {
  const html = buildPrerenderedHtml({
    title,
    description,
    canonicalPath,
    jsonLdObjects,
    bodyHtml
  });

  const segments = canonicalPath.replace(/^\//, "").split("/");
  const outDir = path.join(distDir, ...segments);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");
}

writePage({
  path: BLOG_HUB_SEO.path,
  title: BLOG_HUB_SEO.title,
  description: BLOG_HUB_SEO.description,
  jsonLdObjects: [],
  bodyHtml: blogHubBody(blogPosts)
});

for (const post of blogPosts) {
  writePage({
    path: post.path,
    title: post.title,
    description: post.description,
    jsonLdObjects: [buildBlogPostingJsonLd({ post, siteOrigin: siteUrl })],
    bodyHtml: blogPostBody(post)
  });
}

console.log(`[prerender-blog] wrote ${blogPosts.length + 1} HTML file(s) under dist/blog/`);
