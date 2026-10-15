import type { GridCell, RadianceClass, ViirsDensity } from "./types";

/** Pusat sel grid VIIRS: lon0 + (ix + 0,5) × res. */
export function gridCenter(cell: GridCell, grid: { res: number; lon0: number; lat0: number }) {
  return { lon: grid.lon0 + (cell[0] + 0.5) * grid.res, lat: grid.lat0 + (cell[1] + 0.5) * grid.res };
}

/** Nilai maksimum tanpa spread (grid berisi puluhan ribu sel — spread meluapkan call stack). */
export function maxOf(values: Iterable<number>): number {
  let m = 0;
  for (const v of values) if (v > m) m = v;
  return m;
}

export type DensityKey = "all" | RadianceClass;

/**
 * Titik heatmap kepadatan VIIRS untuk satu kelas. Bobot = (ln(1 + n) / ln(1 + maks))^e, dinormalisasi per kelas.
 * Kelas padat memakai e = 2 agar kernel tidak jenuh; kelas jarang (< 15.000 sel, mis. radiansi tinggi) memakai e = 1
 * dan intensitas lebih besar (`sparse`) agar konsentrasinya tetap terlihat.
 */
export function densityFeatures(data: ViirsDensity, key: DensityKey) {
  const col = data.columns.indexOf(key);
  const cells = data.cells.filter((c) => c[col] > 0);
  const max = maxOf(cells.map((c) => c[col]));
  const denom = Math.log1p(max) || 1;
  const sparse = cells.length < 15000;
  const exponent = sparse ? 1 : 2;
  return {
    max,
    sparse,
    fc: {
      type: "FeatureCollection" as const,
      features: cells.map((c, i) => {
        const { lon, lat } = gridCenter(c, data);
        return {
          type: "Feature" as const,
          id: i,
          geometry: { type: "Point" as const, coordinates: [lon, lat] },
          properties: { v: c[col], w: (Math.log1p(c[col]) / denom) ** exponent, all: c[2], low: c[3], medium: c[4], high: c[5], lat, lon },
        };
      }),
    },
  };
}
