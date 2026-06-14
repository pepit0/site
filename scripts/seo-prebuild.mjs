import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchPublicInventoryUnits } from "./lib/fetch-public-inventory.mjs";
import { FINANCING_PRERENDER_PAGES } from "./lib/financing-seo.mjs";
import { loadViteBuildEnv } from "./lib/read-vite-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const DEFAULT_ORIGIN = "https://temptmotorsports.com";
const { siteUrl, supabaseUrl, supabaseAnonKey } = loadViteBuildEnv(root);
const origin = siteUrl || DEFAULT_ORIGIN;

if (!siteUrl) {
  console.warn(
    `[seo-prebuild] VITE_PUBLIC_SITE_URL is not set. Using ${DEFAULT_ORIGIN} for sitemap/robots. ` +
      "Set VITE_PUBLIC_SITE_URL in .env.local or Vercel Production if your live host differs."
  );
}

const financingUrls = FINANCING_PRERENDER_PAGES.map((page) => ({
  loc: page.path,
  priority: page.path === "/financing" ? "0.88" : "0.86",
  changefreq: "monthly"
}));

const staticUrls = [
  { loc: "/", priority: "1.0", changefreq: "weekly" },
  { loc: "/inventory", priority: "0.9", changefreq: "daily" },
  ...financingUrls,
  { loc: "/about", priority: "0.75", changefreq: "monthly" },
  { loc: "/contact", priority: "0.75", changefreq: "monthly" },
  { loc: "/apply", priority: "0.8", changefreq: "weekly" },
  { loc: "/sell-your-ride", priority: "0.8", changefreq: "weekly" },
  { loc: "/sell-your-ride/apply", priority: "0.7", changefreq: "monthly" }
];

const defaultLastmod = new Date().toISOString().slice(0, 10);

/** @type {{ loc: string; priority: string; changefreq: string; lastmod: string }[]} */
let inventoryUrls = [];

if (supabaseUrl && supabaseAnonKey) {
  const { rows, error } = await fetchPublicInventoryUnits({ supabaseUrl, supabaseAnonKey });
  if (error) {
    console.warn(`[seo-prebuild] Could not fetch inventory for sitemap (${error}). Static URLs only.`);
  } else {
    inventoryUrls = rows.map((row) => ({
      loc: `/inventory/${row.id}`,
      priority: row.status === "Sold" ? "0.5" : "0.7",
      changefreq: row.status === "Available" ? "daily" : "weekly",
      lastmod: (row.updated_at || defaultLastmod).slice(0, 10)
    }));
    console.log(`[seo-prebuild] ${inventoryUrls.length} inventory unit URL(s) for sitemap`);
  }
} else {
  console.warn(
    "[seo-prebuild] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — sitemap will omit /inventory/{id} URLs."
  );
}

function urlEntry({ loc, priority, changefreq, lastmod }) {
  return `  <url>\n    <loc>${origin}${loc}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
}

const allUrls = [
  ...staticUrls.map((u) => ({ ...u, lastmod: defaultLastmod })),
  ...inventoryUrls
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(urlEntry).join("\n")}
</urlset>
`;

const robots = `User-agent: *
Allow: /

Disallow: /admin/
Disallow: /login
Disallow: /staff
Disallow: /apply/complete

Sitemap: ${origin}/sitemap.xml
`;

const publicDir = path.join(root, "public");
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, "sitemap.xml"), sitemap, "utf8");
fs.writeFileSync(path.join(publicDir, "robots.txt"), robots, "utf8");
console.log("[seo-prebuild] wrote public/sitemap.xml and public/robots.txt");
