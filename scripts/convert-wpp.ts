/**
 * Konversi 11 Shapefile WPP-RI → GeoJSON sederhana (data/wpp/wpp-<kode>.geojson) + ringkasan statistik.
 *   npx tsx scripts/convert-wpp.ts [toleransiDerajat=0.005] [minLuasPulauDerajat2=0.002] [--dry]
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parsePolygonShapefile, toMultiPolygon } from "@/lib/geo/shapefile";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dry = process.argv.includes("--dry");
const tolerance = Number(args[0] ?? 0.005);
const minHoleArea = Number(args[1] ?? 0.002);
const SRC = path.resolve("shp&shx");
const OUT = path.resolve("data", "wpp");

const files = readdirSync(SRC)
  .filter((f) => /^namobj_WPP-RI (\d{3})\.shp$/i.test(f))
  .sort();
if (files.length === 0) throw new Error(`Tidak ada file namobj_WPP-RI ###.shp di ${SRC}`);
if (!dry) mkdirSync(OUT, { recursive: true });

let total = 0;
let bytesTotal = 0;
console.log(`toleransi ${tolerance}° (±${Math.round(tolerance * 111_000)} m) · pulau < ${minHoleArea} derajat² (±${Math.round(minHoleArea * 12_300)} km²) dilebur\n`);
for (const f of files) {
  const code = f.match(/(\d{3})\.shp$/i)![1];
  const parsed = parsePolygonShapefile(readFileSync(path.join(SRC, f)));
  const { geometry, stats } = toMultiPolygon(parsed, { tolerance, minHoleArea });
  const fc = { type: "FeatureCollection", features: [{ type: "Feature", properties: { wpp: code }, geometry }] };
  const text = JSON.stringify(fc);
  total += stats.pointsOut;
  bytesTotal += text.length;
  if (!dry) writeFileSync(path.join(OUT, `wpp-${code}.geojson`), text + "\n");
  console.log(
    `WPP ${code}: titik ${stats.pointsIn.toLocaleString("id-ID")} → ${stats.pointsOut.toLocaleString("id-ID")} · ` +
      `poligon ${stats.outers} (serpihan dibuang ${stats.outersDropped}) · pulau ${stats.holesIn} → ${stats.holesKept} (kecil ${stats.holesDroppedSmall}, tanpa induk ${stats.holesOrphan}) · ` +
      `potong-sendiri ${stats.selfIntersections} (+${stats.repairedRings} titik perbaikan, pulau dilebur ${stats.holesMerged}) · ${(text.length / 1024).toFixed(0)} KB`,
  );
}
console.log(`\ntotal titik ${total.toLocaleString("id-ID")} · ${(bytesTotal / 1024).toFixed(0)} KB${dry ? " (dry run, tidak ditulis)" : ` → ${OUT}`}`);
