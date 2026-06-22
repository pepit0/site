import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchPublicBlogPosts } from "./lib/fetch-public-blog.mjs";
import { BLOG_HUB_SEO, buildBlogPostingJsonLd } from "./lib/blog-seo.mjs";
import { buildPrerenderedHtml, escapeHtml } from "./lib/prerender-html.mjs";
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
      <p><a href="/financing">Financing guides</a> · <a href="/inventory">Inventory</a> · <a href="/faq">FAQ</a></p>
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
      <p>
        <a href="/apply">Apply for financing</a> ·
        <a href="/financing">Financing guides</a> ·
        <a href="/inventory">Inventory</a> ·
        <a href="/blog">Back to blog</a>
      </p>
    </article>`;
}

function writePage({ path: canonicalPath, title, description, jsonLdObjects, bodyHtml }) {
  const html = buildPrerenderedHtml(shellHtml, {
    siteUrl,
    title,
    description,
    canonicalPath,
    jsonLdObjects,
    bodyHtml,
    mainClass: "inventory-prerender blog-prerender",
    mainId: "blog-prerender-fallback"
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
