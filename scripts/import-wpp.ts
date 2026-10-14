/**
 * Konversi 11 Shapefile WPP-RI (folder `shp&shx/`) lalu impor ke tabel `regions` (wpp-571 … wpp-718).
 *   npm run regions:import-wpp
 * Penyederhanaan: Douglas–Peucker 0,005° (±555 m) + perbaikan lokal perpotongan; pulau < 0,002 derajat² dilebur.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();
const TOLERANCE = 0.005;
const MIN_HOLE = 0.002;

async function main() {
  const { parsePolygonShapefile, toMultiPolygon } = await import("@/lib/geo/shapefile");
  const { importWppRegion } = await import("@/lib/regions");
  const dir = path.resolve("shp&shx");
  const files = readdirSync(dir).filter((f) => /^namobj_WPP-RI (\d{3})\.shp$/i.test(f)).sort();
  if (files.length === 0) throw new Error(`Tidak ada file namobj_WPP-RI ###.shp di ${dir}`);
  for (const f of files) {
    const code = f.match(/(\d{3})\.shp$/i)![1];
    const raw = readFileSync(path.join(dir, f));
    const { geometry, stats } = toMultiPolygon(parsePolygonShapefile(raw), { tolerance: TOLERANCE, minHoleArea: MIN_HOLE });
    if (stats.selfIntersections > 0) throw new Error(`WPP ${code}: masih ada ${stats.selfIntersections} perpotongan setelah penyederhanaan.`);
    const text = JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", properties: { wpp: code }, geometry }] });
    const notes =
      `Dari ${f} (sha256 ${createHash("sha256").update(raw).digest("hex").slice(0, 16)}…, ${stats.pointsIn} titik). ` +
      `Disederhanakan ${TOLERANCE}° (±555 m) → ${stats.pointsOut} titik; pulau < ${MIN_HOLE} derajat² dilebur (${stats.holesDroppedSmall}), ` +
      `${stats.holesKept} pulau dipertahankan, ${stats.outersDropped} serpihan berluas ≈0 dibuang, 0 perpotongan.`;
    const region = importWppRegion(code, text, notes);
    console.log(`${region.name}: ${stats.pointsOut} titik · bbox ${region.bbox.map((n) => n.toFixed(2)).join(", ")}`);
  }
}

main().catch((e) => {
  console.error("GAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
