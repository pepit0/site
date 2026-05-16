/**
 * 1200×630 Open Graph image: dark brand bg + accent stripe + logo.
 * Run via prebuild or: node scripts/build-og-default.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "public");
const logoPath = path.join(root, "src/assets/Tlogo.png");

const W = 1200;
const H = 630;
const bg = { r: 12, g: 13, b: 16, alpha: 1 };
const accent = { r: 240, g: 93, b: 34, alpha: 1 };

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const stripe = await sharp({
  create: { width: W, height: 12, channels: 4, background: accent }
})
  .png()
  .toBuffer();

const composites = [{ input: stripe, left: 0, top: H - 12 }];

if (fs.existsSync(logoPath)) {
  const logoBuf = await sharp(logoPath)
    .ensureAlpha()
    .resize({ width: 340, height: 340, fit: "inside" })
    .png()
    .toBuffer();
  const { height: lh = 200 } = await sharp(logoBuf).metadata();
  composites.push({
    input: logoBuf,
    left: 72,
    top: Math.max(48, Math.round((H - lh) / 2) - 36)
  });
}

await sharp({
  create: { width: W, height: H, channels: 4, background: bg }
})
  .composite(composites)
  .png()
  .toFile(path.join(outDir, "og-default.png"));

console.log("[build-og-default] wrote public/og-default.png");
