/**
 * Periksa file Shapefile WPP (hanya .shp/.shx) tanpa dependensi: tipe geometri, bbox, jumlah record/ring/titik,
 * orientasi ring, dan apakah koordinat berada di rentang derajat (lon/lat).
 *   npx tsx scripts/inspect-shapefile.ts "shp&shx"
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SHAPE_TYPES: Record<number, string> = { 0: "Null", 1: "Point", 3: "PolyLine", 5: "Polygon", 8: "MultiPoint", 11: "PointZ", 13: "PolyLineZ", 15: "PolygonZ", 21: "PointM", 23: "PolyLineM", 25: "PolygonM" };

function signedArea(pts: Array<[number, number]>) {
  let a = 0;
  for (let i = 0; i < pts.length - 1; i++) a += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
  return a / 2;
}

function inspect(file: string) {
  const buf = readFileSync(file);
  const code = buf.readInt32BE(0);
  const fileLen = buf.readInt32BE(24) * 2;
  const type = buf.readInt32LE(32);
  const bbox = [buf.readDoubleLE(36), buf.readDoubleLE(44), buf.readDoubleLE(52), buf.readDoubleLE(60)];
  let off = 100;
  let records = 0;
  let rings = 0;
  let points = 0;
  let outer = 0;
  let holes = 0;
  let openRings = 0;
  const recTypes = new Set<number>();
  while (off < fileLen) {
    const contentLen = buf.readInt32BE(off + 4) * 2;
    const c = off + 8;
    const rt = buf.readInt32LE(c);
    recTypes.add(rt);
    if (rt === 5 || rt === 15 || rt === 25) {
      const nParts = buf.readInt32LE(c + 36);
      const nPoints = buf.readInt32LE(c + 40);
      const parts: number[] = [];
      for (let i = 0; i < nParts; i++) parts.push(buf.readInt32LE(c + 44 + i * 4));
      const pBase = c + 44 + nParts * 4;
      for (let p = 0; p < nParts; p++) {
        const start = parts[p];
        const end = p + 1 < nParts ? parts[p + 1] : nPoints;
        const ring: Array<[number, number]> = [];
        for (let i = start; i < end; i++) ring.push([buf.readDoubleLE(pBase + i * 16), buf.readDoubleLE(pBase + i * 16 + 8)]);
        const [f, l] = [ring[0], ring[ring.length - 1]];
        if (f[0] !== l[0] || f[1] !== l[1]) openRings++;
        // Shapefile: ring luar searah jarum jam (area bertanda negatif), lubang berlawanan.
        if (signedArea(ring) < 0) outer++;
        else holes++;
      }
      rings += nParts;
      points += nPoints;
    }
    records++;
    off += 8 + contentLen;
  }
  const degrees = bbox[0] >= -180 && bbox[2] <= 180 && bbox[1] >= -90 && bbox[3] <= 90;
  return { code, fileLen, actualLen: statSync(file).size, type: SHAPE_TYPES[type] ?? type, recordTypes: [...recTypes].map((t) => SHAPE_TYPES[t] ?? t), bbox: bbox.map((v) => +v.toFixed(4)), degrees, records, rings, outer, holes, openRings, points };
}

const dir = path.resolve(process.argv[2] ?? "shp&shx");
const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".shp")).sort();
const others = readdirSync(dir).filter((f) => !/\.(shp|shx)$/i.test(f));
console.log(`folder: ${dir}\nfile .shp: ${files.length} · file lain (dbf/prj/cpg): ${others.length ? others.join(", ") : "tidak ada"}\n`);
for (const f of files) {
  const r = inspect(path.join(dir, f));
  const shx = existsShx(path.join(dir, f));
  console.log(
    `${f.padEnd(24)} kode=${r.code} ${r.fileLen === r.actualLen ? "ukuran-ok" : `UKURAN BEDA ${r.fileLen}/${r.actualLen}`} shx=${shx} tipe=${r.type} ` +
      `record=${r.records} ring=${r.rings} (luar ${r.outer}, lubang ${r.holes}, terbuka ${r.openRings}) titik=${r.points} ` +
      `bbox=[${r.bbox.join(", ")}] derajat=${r.degrees}`,
  );
}

function existsShx(shp: string) {
  try {
    return statSync(shp.replace(/\.shp$/i, ".shx")).size > 100;
  } catch {
    return false;
  }
}
