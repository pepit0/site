/**
 * WebP hero background for smaller LCP payload. Regenerates when source PNG changes.
 * Run via prebuild or: node scripts/build-hero-webp.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcPath = path.join(root, "src/assets/background.png");
const outPath = path.join(root, "src/assets/background.webp");

if (!fs.existsSync(srcPath)) {
  console.warn("[build-hero-webp] missing src/assets/background.png — skip");
  process.exit(0);
}

await sharp(srcPath).webp({ quality: 82, effort: 4 }).toFile(outPath);
console.log("[build-hero-webp] wrote src/assets/background.webp");
