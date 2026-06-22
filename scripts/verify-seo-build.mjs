import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadViteBuildEnv } from "./lib/read-vite-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const distDir = path.join(root, "dist");

const { siteUrl, supabaseUrl, supabaseAnonKey } = loadViteBuildEnv(root);

const requiredFiles = ["robots.txt", "sitemap.xml", "llms.txt"];
const errors = [];
const warnings = [];

for (const name of requiredFiles) {
  const filePath = path.join(distDir, name);
  if (!fs.existsSync(filePath)) {
    errors.push(`Missing dist/${name} — seo-prebuild should run before vite build.`);
  }
}

if (!siteUrl) {
  warnings.push("VITE_PUBLIC_SITE_URL is not set — prerender scripts may have been skipped.");
}
if (!supabaseUrl || !supabaseAnonKey) {
  warnings.push("Supabase env vars missing — inventory prerender may have been skipped.");
}

const inventoryDir = path.join(distDir, "inventory");
let inventoryUnitPages = 0;
if (fs.existsSync(inventoryDir)) {
  for (const entry of fs.readdirSync(inventoryDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "index.html") continue;
    const unitHtml = path.join(inventoryDir, entry.name, "index.html");
    if (fs.existsSync(unitHtml)) inventoryUnitPages += 1;
  }
}

const listIndex = path.join(inventoryDir, "index.html");
const prerenderExpected = Boolean(siteUrl && supabaseUrl && supabaseAnonKey);

if (prerenderExpected && !fs.existsSync(listIndex)) {
  errors.push("Missing dist/inventory/index.html — inventory list prerender failed.");
} else if (!prerenderExpected && !fs.existsSync(listIndex)) {
  warnings.push("Inventory prerender skipped (set VITE_PUBLIC_SITE_URL and Supabase vars for production SEO HTML).");
}

if (prerenderExpected && inventoryUnitPages < 1) {
  errors.push(
    "No dist/inventory/{id}/index.html files found but build env is set — prerender-inventory did not write unit pages."
  );
} else if (inventoryUnitPages > 0) {
  const sampleDir = fs
    .readdirSync(inventoryDir, { withFileTypes: true })
    .find((e) => e.isDirectory() && e.name !== "index.html");
  if (sampleDir) {
    const sampleHtml = fs.readFileSync(path.join(inventoryDir, sampleDir.name, "index.html"), "utf8");
    if (!/<link rel="canonical"/i.test(sampleHtml)) {
      errors.push("Sample inventory prerender HTML is missing canonical link.");
    }
    if (!/<h1\b/i.test(sampleHtml)) {
      errors.push("Sample inventory prerender HTML is missing h1.");
    }
    if (/Powersports &amp; motorsports financing Canada/i.test(sampleHtml)) {
      errors.push("Sample inventory page still has home-page title — prerender meta not applied.");
    }
  }
  console.log(`[verify-seo-build] ${inventoryUnitPages} inventory unit prerender page(s) OK`);
}

for (const w of warnings) console.warn(`[verify-seo-build] WARNING: ${w}`);
for (const e of errors) console.error(`[verify-seo-build] ERROR: ${e}`);

if (errors.length > 0) process.exit(1);
console.log("[verify-seo-build] SEO build artifacts verified.");
