// Aset statis landing: peta titik 11 WPP, ombak footer, peta malam VIIRS, foto laut, dan logo UPI.
// Pakai: node scripts/landing/build-assets.mjs <ombak.jpg> <logo-upi.png> <video-asli.mp4>
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const STEP = 0.5; // derajat antar-titik
const LON0 = 90.5;
const LAT1 = 9.5;
const SCALE = 10; // satuan SVG per derajat

function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inMulti(lon, lat, polygons) {
  return polygons.some(([outer, ...holes]) => inRing(lon, lat, outer) && !holes.some((h) => inRing(lon, lat, h)));
}

function buildDots() {
  const dir = "data/wpp";
  const wpp = {};
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".geojson")).sort()) {
    const code = file.match(/\d{3}/)[0];
    const polygons = JSON.parse(readFileSync(join(dir, file), "utf8")).features.flatMap((f) =>
      f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates],
    );
    const dots = [];
    for (let lat = LAT1; lat >= -16; lat -= STEP) {
      for (let lon = LON0; lon <= 142; lon += STEP) {
        if (inMulti(lon, lat, polygons)) dots.push([Math.round((lon - LON0) * SCALE), Math.round((LAT1 - lat) * SCALE)]);
      }
    }
    const cx = Math.round(dots.reduce((s, d) => s + d[0], 0) / dots.length);
    const cy = Math.round(dots.reduce((s, d) => s + d[1], 0) / dots.length);
    // Penanda di titik WPP yang paling dekat ke pusat, supaya selalu jatuh di dalam wilayahnya.
    const center = dots.reduce((b, d) => (Math.hypot(d[0] - cx, d[1] - cy) < Math.hypot(b[0] - cx, b[1] - cy) ? d : b));
    wpp[code] = { center, path: dots.map(([x, y]) => `M${x} ${y}h0`).join(""), count: dots.length };
  }
  const all = Object.values(wpp);
  const out = { viewBox: `-5 -5 ${(142 - LON0) * SCALE + 10} ${(LAT1 + 16) * SCALE + 10}`, dotSize: STEP * SCALE * 0.55, wpp };
  mkdirSync("src/data/landing", { recursive: true });
  writeFileSync("src/data/landing/wpp-dots.json", JSON.stringify(out));
  console.log("titik", all.reduce((s, w) => s + w.count, 0), "ukuran", JSON.stringify(out).length);
}

async function buildWave(source) {
  const { data, info } = await sharp(source).resize({ width: 1500, kernel: "lanczos3" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const px = (x, y) => (y * w + x) * 4;
  const isBackground = (i) => Math.min(data[i], data[i + 1], data[i + 2]) > 232;
  // Isi banjir dari tepi atas: hanya putih latar yang hilang, putih buih ombak tetap ada.
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push([x, 0]);
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h || seen[y * w + x]) continue;
    seen[y * w + x] = 1;
    if (!isBackground(px(x, y))) continue;
    data[px(x, y) + 3] = 0;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  // Tepi transparan dihaluskan supaya tidak bergerigi saat tampil selebar layar.
  const alpha = Buffer.alloc(w * h);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
  const softAlpha = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } }).blur(1.4).toColourspace("b-w").raw().toBuffer();
  for (let i = 0; i < alpha.length; i++) data[i * 4 + 3] = softAlpha[i];
  mkdirSync("public/landing", { recursive: true });
  await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .modulate({ saturation: 0.3, brightness: 0.82 })
    .webp({ quality: 82, alphaQuality: 90 })
    .toFile("public/landing/ombak-v1.webp");
}

/** Peta sebaran deteksi kapal malam dari data VIIRS asli (src/data/viirs/density.json). */
async function buildViirsNight() {
  const { res, lon0, lat0, cells } = JSON.parse(readFileSync("src/data/viirs/density.json", "utf8"));
  const scale = 4;
  const nx = Math.round((142 - lon0) / res);
  const ny = Math.round((10 - lat0) / res);
  const width = nx * scale;
  const height = ny * scale;
  const sorted = cells.map((c) => c[2]).sort((a, b) => a - b);
  const top = Math.log1p(sorted[Math.floor(sorted.length * 0.995)]);
  const glow = Buffer.alloc(width * height);
  for (const [ix, iy, all] of cells) {
    if (ix >= nx || iy >= ny) continue;
    const value = Math.round(255 * Math.min(1, Math.log1p(all) / top) ** 2.2);
    for (let y = 0; y < scale; y++) {
      for (let x = 0; x < scale; x++) glow[((ny - 1 - iy) * scale + y) * width + ix * scale + x] = value;
    }
  }
  const soft = await sharp(glow, { raw: { width, height, channels: 1 } }).blur(1.6).toColourspace("b-w").raw().toBuffer();
  const rgb = Buffer.alloc(width * height * 3);
  for (let i = 0; i < soft.length; i++) {
    const t = soft[i] / 255;
    rgb[i * 3] = Math.min(255, t * 560); // jingga ke putih hangat, senada aksen landing
    rgb[i * 3 + 1] = Math.min(255, t * t * 360 + t * 70);
    rgb[i * 3 + 2] = Math.min(255, t ** 3 * 300 + t * 18);
  }
  await sharp(rgb, { raw: { width, height, channels: 3 } }).webp({ quality: 74 }).toFile("public/landing/viirs-night-v1.webp");
}

/** Dua potongan laut dari video, tanpa kapal. */
function buildStills(video) {
  const still = (crop, grade, out) =>
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", video, "-frames:v", "1", "-vf", `crop=${crop},eq=${grade}`, "-c:v", "libwebp", "-quality", "74", out]);
  still("1680:760:0:980", "saturation=0.6:contrast=1.05", "public/landing/riak-v1.webp");
  still("1760:760:0:220", "saturation=1.25:contrast=1.2:brightness=-0.03", "public/landing/cakrawala-v2.webp");
}

async function buildLogo(source) {
  await sharp(source).resize({ width: 240 }).png({ palette: true, quality: 90 }).toFile("public/landing/logo-upi.png");
}

const [wave, logo, video] = process.argv.slice(2);
buildDots();
await buildWave(wave);
await buildViirsNight();
buildStills(video);
await buildLogo(logo);
