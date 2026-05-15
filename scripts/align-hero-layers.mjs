/**
 * Finds where each trimmed layer sits on background.png (pixel match on alpha).
 * Run: node scripts/align-hero-layers.mjs
 */
import sharp from "sharp";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const assets = join(__dirname, "../src/assets");
const BG_W = 2000;
const BG_H = 1123;

const layers = [
  "ATV_0000_Layer-9.png",
  "ATV_0001_Layer-10.png",
  "ATV_0002_Layer-5.png",
  "ATV_0003_Layer-1.png",
  "ATV_0004_Layer-2.png",
  "ATV_0005_Layer-11.png",
  "ATV_0006_Layer-7.png",
  "SIDE.jpg",
  "SNOWMOBILE.webp"
];

async function loadRgba(path, w, h) {
  return sharp(path)
    .resize(w, h, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer();
}

function scoreAt(bg, bgW, bgH, layer, layerW, layerH, ox, oy) {
  let score = 0;
  let count = 0;
  for (let y = 0; y < layerH; y++) {
    for (let x = 0; x < layerW; x++) {
      const la = layer[(y * layerW + x) * 4 + 3];
      if (la < 32) continue;
      const bx = ox + x;
      const by = oy + y;
      if (bx < 0 || by < 0 || bx >= bgW || by >= bgH) continue;
      const bi = (by * bgW + bx) * 4;
      const dr = Math.abs(bg[bi] - layer[(y * layerW + x) * 4]);
      const dg = Math.abs(bg[bi + 1] - layer[(y * layerW + x) * 4 + 1]);
      const db = Math.abs(bg[bi + 2] - layer[(y * layerW + x) * 4 + 2]);
      score -= dr + dg + db;
      count++;
    }
  }
  return count > 0 ? score / count : -Infinity;
}

async function findPlacement(bgPath, layerPath) {
  const bgMeta = await sharp(bgPath).metadata();
  const layerMeta = await sharp(layerPath).metadata();
  const bgW = bgMeta.width;
  const bgH = bgMeta.height;
  const layerW = layerMeta.width;
  const layerH = layerMeta.height;

  const scale = 0.25;
  const sBgW = Math.round(bgW * scale);
  const sBgH = Math.round(bgH * scale);
  const sLayerW = Math.round(layerW * scale);
  const sLayerH = Math.round(layerH * scale);

  const bg = await loadRgba(bgPath, sBgW, sBgH);
  const layer = await loadRgba(layerPath, sLayerW, sLayerH);

  const yMin = Math.floor(sBgH * 0.32);
  let best = { x: 0, y: yMin, s: -Infinity };
  const step = 2;
  for (let oy = yMin; oy <= sBgH - sLayerH; oy += step) {
    for (let ox = 0; ox <= sBgW - sLayerW; ox += step) {
      const s = scoreAt(bg, sBgW, sBgH, layer, sLayerW, sLayerH, ox, oy);
      if (s > best.s) best = { x: ox, y: oy, s };
    }
  }

  const refine = async (ox0, oy0, radius) => {
    let local = { x: ox0, y: oy0, s: best.s };
    for (let oy = Math.max(0, oy0 - radius); oy <= Math.min(sBgH - sLayerH, oy0 + radius); oy++) {
      for (let ox = Math.max(0, ox0 - radius); ox <= Math.min(sBgW - sLayerW, ox0 + radius); ox++) {
        const s = scoreAt(bg, sBgW, sBgH, layer, sLayerW, sLayerH, ox, oy);
        if (s > local.s) local = { x: ox, y: oy, s };
      }
    }
    return local;
  };

  best = await refine(best.x, best.y, 4);
  best = await refine(best.x, best.y, 2);

  const x = Math.round(best.x / scale);
  const y = Math.round(best.y / scale);
  return {
    file: layerPath.split(/[/\\]/).pop(),
    left: ((x / bgW) * 100).toFixed(2),
    top: ((y / bgH) * 100).toFixed(2),
    width: ((layerW / bgW) * 100).toFixed(2),
    height: ((layerH / bgH) * 100).toFixed(2),
    px: { x, y, w: layerW, h: layerH }
  };
}

const bgPath = join(assets, "background.png");
console.log(`Background reference: ${BG_W}x${BG_H}\n`);

for (const file of layers) {
  const p = join(assets, file);
  try {
    const r = await findPlacement(bgPath, p);
    console.log(
      `${r.file}: left ${r.left}%, top ${r.top}%, width ${r.width}%, height ${r.height}%  (px ${r.px.x},${r.px.y} ${r.px.w}x${r.px.h})`
    );
  } catch (e) {
    console.log(`${file}: ${e.message}`);
  }
}
