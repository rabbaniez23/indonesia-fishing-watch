/**
 * Impor geometri ZEE Indonesia dari fixture contract check ke tabel `regions`.
 *   npm run regions:import
 * File sumber: fixtures/gfw/region-eez-8492.geojson (ditulis oleh `npm run contract-check`).
 */
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

async function main() {
  const { importEezIndonesia } = await import("@/lib/regions");
  const file = path.join(process.cwd(), "fixtures", "gfw", "region-eez-8492.geojson");
  const text = readFileSync(file, "utf8");
  const region = importEezIndonesia(text, statSync(file).mtime.toISOString());
  console.log(`Wilayah tersimpan: ${region.name} (${region.id})`);
  console.log(`  GFW region: ${region.gfwRegion?.dataset} ${region.gfwRegion?.id}`);
  console.log(`  bbox: ${region.bbox.map((n) => n.toFixed(3)).join(", ")}`);
  console.log(`  sha256: ${region.geometryHash}`);
  console.log(`  ${region.notes}`);
}

void main();
