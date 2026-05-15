/**
 * Rasterizes SVG sources to transparent PNGs in public/vehicle-category-icons/.
 * Run: npm run build:vehicle-icons
 */
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const srcDir = join(__dirname, "vehicle-icon-sources");
const outDir = join(root, "public", "vehicle-category-icons");

const jobs = [
  { out: "motorcycle", file: "motorcycle.svg" },
  { out: "atv", file: "atv.svg" },
  { out: "snowmobile", file: "snowmobile.svg" },
  { out: "side-by-side", file: "side-by-side.svg" },
  { out: "watercraft", file: "watercraft.svg" }
];

mkdirSync(outDir, { recursive: true });

for (const { out, file } of jobs) {
  const buf = readFileSync(join(srcDir, file));
  await sharp(buf, { density: 240 })
    .resize(256, 256, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(join(outDir, `${out}.png`));
  console.log(`wrote ${out}.png`);
}
