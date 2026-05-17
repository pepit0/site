import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function readSiteUrlFromEnvFiles() {
  const files = [".env.production.local", ".env.local", ".env.production", ".env"];
  for (const f of files) {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, "utf8");
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const m = t.match(/^VITE_PUBLIC_SITE_URL\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[1].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (v) return v.replace(/\/+$/, "");
    }
  }
  return "";
}

const fromFile = readSiteUrlFromEnvFiles();
const fromProcess = (process.env.VITE_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
const origin = fromProcess || fromFile || "https://example.com";

if (!fromProcess && !fromFile) {
  console.warn(
    "[seo-prebuild] VITE_PUBLIC_SITE_URL is not set. Using https://example.com for sitemap/robots. " +
      "Set VITE_PUBLIC_SITE_URL in .env.local or your host (e.g. Vercel) before deploying."
  );
}

const urls = ["/", "/inventory", "/pre-approval", "/sell-your-ride", "/sell-your-ride/apply"];
const lastmod = new Date().toISOString().slice(0, 10);

const urlEntries = urls
  .map((loc) => {
    const priority = loc === "/" ? "1.0" : "0.8";
    return `  <url>\n    <loc>${origin}${loc}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
  })
  .join("\n");

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`;

const robots = `User-agent: *
Allow: /

Disallow: /admin/
Disallow: /login
Disallow: /staff
Disallow: /pre-approval/complete

Sitemap: ${origin}/sitemap.xml
`;

const publicDir = path.join(root, "public");
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, "sitemap.xml"), sitemap, "utf8");
fs.writeFileSync(path.join(publicDir, "robots.txt"), robots, "utf8");
console.log("[seo-prebuild] wrote public/sitemap.xml and public/robots.txt");
