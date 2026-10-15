import { rampColor, scalePos } from "@/lib/oseanografi/format";
import type { OceanGrid } from "@/lib/oseanografi/types";

/**
 * Penggambar grid oseanografi untuk MapLibre (dipakai menu Oseanografi dan lapisan laut di menu Peta, hanya di browser).
 * Grid digambar sebagai satu gambar raster: tiap baris gambar dipetakan ke lintangnya di proyeksi Mercator agar sel
 * tidak bergeser. Arus & angin diberi panah arah (grid 1°).
 */

const CANVAS_W = 880;
const CANVAS_H = 440;

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const invMercY = (y: number) => (Math.atan(Math.sinh(y)) * 180) / Math.PI;

export function dense(grid: OceanGrid, frame: string): Float32Array {
  const out = new Float32Array(grid.nx * grid.ny).fill(NaN);
  const vals = grid.frames[frame];
  if (!vals) return out;
  for (let i = 0; i < grid.cells.length; i++) {
    const v = vals[i];
    if (v !== null) out[grid.cells[i]] = v / grid.scale;
  }
  return out;
}

export function renderImage(grid: OceanGrid, values: Float32Array, ramp: string[]): string {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(CANVAS_W, CANVAS_H);
  const north = grid.lat0 + grid.ny * grid.res;
  const yTop = mercY(north);
  const yBot = mercY(grid.lat0);
  for (let r = 0; r < CANVAS_H; r++) {
    const lat = invMercY(yTop + ((r + 0.5) / CANVAS_H) * (yBot - yTop));
    const iy = Math.floor((lat - grid.lat0) / grid.res);
    if (iy < 0 || iy >= grid.ny) continue;
    for (let c = 0; c < CANVAS_W; c++) {
      const ix = Math.floor(((c + 0.5) / CANVAS_W) * grid.nx);
      const v = values[iy * grid.nx + ix];
      if (!Number.isFinite(v)) continue;
      const [R, G, B] = rampColor(ramp, scalePos(v, grid.vmin, grid.vmax, grid.log));
      const o = (r * CANVAS_W + c) * 4;
      img.data[o] = R;
      img.data[o + 1] = G;
      img.data[o + 2] = B;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

export function corners(grid: OceanGrid): [[number, number], [number, number], [number, number], [number, number]] {
  const w = grid.lon0, e = grid.lon0 + grid.nx * grid.res, s = grid.lat0, n = grid.lat0 + grid.ny * grid.res;
  return [[w, n], [e, n], [e, s], [w, s]];
}

export function arrowFeatures(grid: OceanGrid, frame: string) {
  const a = grid.arrows;
  if (!a || !a.frames[frame]) return { type: "FeatureCollection" as const, features: [] };
  const [us, vs] = a.frames[frame];
  const speeds: number[] = [];
  const features = [];
  for (let i = 0; i < a.cells.length; i++) {
    const u = us[i], v = vs[i];
    if (u === null || v === null) continue;
    const uu = u / a.scale, vv = v / a.scale;
    const speed = Math.hypot(uu, vv);
    speeds.push(speed);
    const cell = a.cells[i];
    const lon = a.lon0 + ((cell % a.nx) + 0.5) * a.res;
    const lat = a.lat0 + (Math.floor(cell / a.nx) + 0.5) * a.res;
    features.push({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [lon, lat] },
      properties: { speed, bearing: (Math.atan2(uu, vv) * 180) / Math.PI },
    });
  }
  const max = speeds.reduce((m, s) => (s > m ? s : m), 0) || 1;
  for (const f of features) (f.properties as Record<string, number>).size = 0.5 + 0.5 * Math.min(1, f.properties.speed / max);
  return { type: "FeatureCollection" as const, features };
}

/** Ikon panah putih (SDF) untuk arah arus/angin. */
export function arrowIcon(): ImageData {
  const s = 32;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(16, 2);
  ctx.lineTo(25, 14);
  ctx.lineTo(19, 14);
  ctx.lineTo(19, 30);
  ctx.lineTo(13, 30);
  ctx.lineTo(13, 14);
  ctx.lineTo(7, 14);
  ctx.closePath();
  ctx.fill();
  return ctx.getImageData(0, 0, s, s);
}
