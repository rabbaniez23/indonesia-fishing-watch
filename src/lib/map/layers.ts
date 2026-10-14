/**
 * Definisi layer kuantitatif peta (FR-03, DS §3.3, §8). Aman diimpor dari client component.
 *
 * Ramp 5 kelas dibangun di OKLCH (hue tetap, L 0,70→0,36; SAR 0,72→0,40) dan lolos validator palet
 * ordinal terhadap warna laut basemap #EEF4F1: monoton, jarak antar-kelas cukup, ujung terang ≥ 2:1.
 * Ramp fishing DS (#EDF6EE…) tidak dipakai di peta karena kelas terangnya 1,10:1 terhadap permukaan
 * sehingga sel bernilai rendah tidak terlihat.
 *
 * `rampDark` dipakai pada basemap gelap (titik bercahaya): arah dibalik — makin ramai makin terang.
 * Lolos validator ordinal terhadap laut gelap #121416 (monoton, satu hue, ujung redup ≥ 2:1).
 */

export type MapLayerKey = "fishingEffort" | "presence" | "sar";

export type MapLayerDef = {
  key: MapLayerKey;
  label: string;
  /** Label legenda/tooltip yang menyebut sifat metric. */
  metricLabel: string;
  unit: string;
  format: "hours" | "count";
  ramp: [string, string, string, string, string];
  rampDark: [string, string, string, string, string];
  caveat: string;
};

export const MAP_LAYERS: Record<MapLayerKey, MapLayerDef> = {
  fishingEffort: {
    key: "fishingEffort",
    label: "Penangkapan ikan",
    metricLabel: "Aktivitas penangkapan ikan",
    unit: "jam",
    format: "hours",
    ramp: ["#63B376", "#48995D", "#2C7F44", "#06652D", "#004D15"],
    rampDark: ["#4D6B1A", "#6E9A1A", "#94C31D", "#BDE51F", "#E6FF4D"],
    caveat: "Perkiraan jam menangkap ikan dari pola gerak AIS — bukan jumlah ikan yang ditangkap.",
  },
  presence: {
    key: "presence",
    label: "Kehadiran kapal",
    metricLabel: "Kehadiran kapal",
    unit: "jam",
    format: "hours",
    ramp: ["#49B3A3", "#279889", "#007E70", "#006558", "#004D41"],
    rampDark: ["#155E75", "#0E7490", "#0891B2", "#22D3EE", "#A5F3FC"],
    caveat: "Total jam kapal ber-AIS berada di kotak ini — bukan jumlah kapal, bukan posisi tepat.",
  },
  sar: {
    key: "sar",
    label: "Radar satelit",
    metricLabel: "Deteksi radar satelit",
    unit: "deteksi",
    format: "count",
    ramp: ["#D8953D", "#BE7C1C", "#A46400", "#8A4C00", "#723500"],
    rampDark: ["#7A4210", "#A3580C", "#CC7008", "#F08A12", "#FFB347"],
    caveat: "Kapal yang terlihat di citra radar, termasuk yang AIS-nya mati. Satu kapal bisa terhitung lebih dari sekali.",
  },
};

export const MAP_LAYER_KEYS = Object.keys(MAP_LAYERS) as MapLayerKey[];

export function isMapLayerKey(value: unknown): value is MapLayerKey {
  return typeof value === "string" && value in MAP_LAYERS;
}

/** Sel 0,1°: koordinat GFW adalah titik tengah (terbukti empiris, fixture 14–15). */
export const CELL_SIZE_DEG = 0.1;
export const CELL_HALF_DEG = CELL_SIZE_DEG / 2;
