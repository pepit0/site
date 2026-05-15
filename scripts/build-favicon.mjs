/**
 * Build tab + home-screen icons from `src/assets/Tlogo.png` (trim transparent
 * padding, then scale). Run: `npm run build:favicon`
 *
 * Tab UIs center the favicon in a fixed slot; we nudge the artwork down/right
 * inside the PNG so it lines up better with the tab title.
 */
import sharp from "sharp";
import fs from "fs";

const src = "src/assets/Tlogo.png";
/** Fully transparent padding / canvas (tab bar shows browser default behind). */
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

let trimmed;
try {
  trimmed = await sharp(src).ensureAlpha().trim({ threshold: 12 }).toBuffer();
} catch {
  trimmed = await sharp(src).ensureAlpha().toBuffer();
}

/** Shift glyph down/right: pad top/left inside the square (browser can't move favicons). */
async function shiftedSquarePng(outPath, size) {
  const ox = Math.max(1, Math.round(size * 0.12));
  const oy = Math.max(1, Math.round(size * 0.15));
  const iw = Math.max(1, size - ox);
  const ih = Math.max(1, size - oy);

  const inner = await sharp(trimmed)
    .resize(iw, ih, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: transparent }
  })
    .composite([{ input: inner, left: ox, top: oy }])
    .png()
    .toFile(outPath);
}

const sizes = [16, 32, 48, 192];
for (const s of sizes) {
  const name = s === 32 ? "public/favicon.png" : `public/favicon-${s}.png`;
  await shiftedSquarePng(name, s);
}

{
  const size = 180;
  const ox = Math.max(2, Math.round(size * 0.11));
  const oy = Math.max(2, Math.round(size * 0.14));
  const iw = Math.max(1, size - ox);
  const ih = Math.max(1, size - oy);
  const inner = await sharp(trimmed)
    .resize(iw, ih, { fit: "contain", background: transparent, position: "centre" })
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: transparent }
  })
    .composite([{ input: inner, left: ox, top: oy }])
    .png()
    .toFile("public/apple-touch-icon.png");
}

for (const f of [
  "public/favicon.png",
  "public/favicon-16.png",
  "public/favicon-48.png",
  "public/favicon-192.png",
  "public/apple-touch-icon.png"
]) {
  console.log(f, fs.statSync(f).size, "bytes");
}
