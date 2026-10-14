import type { Cell, DailyPoint, FlagTotal } from "./aggregate";

/**
 * Statistik deskriptif murni untuk halaman Analisis. Aturan PRD §9 tetap berlaku:
 * hari tanpa baris (null) tidak dihitung sebagai nol; hasil null bila datanya tidak cukup.
 */

export type SeriesStats = {
  /** Jumlah hari yang memiliki nilai. */
  days: number;
  total: number;
  mean: number;
  median: number;
  min: { date: string; value: number };
  max: { date: string; value: number };
  /** Simpangan baku populasi antar-hari. */
  std: number;
  /** Koefisien variasi (std / mean); null bila mean = 0. */
  cv: number | null;
};

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function describeSeries(series: DailyPoint[]): SeriesStats | null {
  const known = series.filter((p): p is { date: string; value: number } => p.value !== null);
  if (known.length === 0) return null;
  const values = known.map((p) => p.value);
  const total = values.reduce((s, v) => s + v, 0);
  const mean = total / values.length;
  const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
  let min = known[0];
  let max = known[0];
  for (const p of known) {
    if (p.value < min.value) min = p;
    if (p.value > max.value) max = p;
  }
  return { days: known.length, total, mean, median: median(values), min, max, std, cv: mean > 0 ? std / mean : null };
}

/** Label kestabilan dari koefisien variasi — bahasa awam, bukan penilaian. */
export function stabilityLabel(cv: number | null): string {
  if (cv === null) return "Tidak dapat dihitung";
  if (cv < 0.15) return "Stabil";
  if (cv < 0.35) return "Cukup bervariasi";
  return "Sangat bervariasi";
}

export const WEEKDAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"] as const;

export type WeekdayStat = { day: (typeof WEEKDAYS)[number]; mean: number | null; days: number };

/** Rata-rata per hari dalam seminggu (UTC), hanya dari hari yang memiliki nilai. */
export function weekdayPattern(series: DailyPoint[]): WeekdayStat[] {
  const sums = Array(7).fill(0) as number[];
  const counts = Array(7).fill(0) as number[];
  for (const p of series) {
    if (p.value === null) continue;
    // getUTCDay: 0 = Minggu → geser agar Senin = 0.
    const i = (new Date(`${p.date}T00:00:00Z`).getUTCDay() + 6) % 7;
    sums[i] += p.value;
    counts[i] += 1;
  }
  return WEEKDAYS.map((day, i) => ({ day, mean: counts[i] ? sums[i] / counts[i] : null, days: counts[i] }));
}

/** Rata-rata bergerak 7 hari (mundur); null bila jendela memiliki < 4 hari bernilai. */
export function movingAverage(series: DailyPoint[], window = 7, minPoints = 4): DailyPoint[] {
  return series.map((p, i) => {
    const slice = series.slice(Math.max(0, i - window + 1), i + 1).filter((q) => q.value !== null);
    return { date: p.date, value: slice.length >= minPoints ? slice.reduce((s, q) => s + q.value!, 0) / slice.length : null };
  });
}

export type FlagGroups = {
  domestic: number;
  foreign: number;
  unknown: number;
  total: number;
  foreignFlags: number;
};

/** Pengelompokan bendera: Indonesia / bendera lain / tidak diketahui. */
export function flagGroups(flags: FlagTotal[], home = "IDN"): FlagGroups {
  const g: FlagGroups = { domestic: 0, foreign: 0, unknown: 0, total: 0, foreignFlags: 0 };
  for (const f of flags) {
    g.total += f.value;
    if (f.flag === null || f.flag === "") g.unknown += f.value;
    else if (f.flag === home) g.domestic += f.value;
    else {
      g.foreign += f.value;
      g.foreignFlags += 1;
    }
  }
  return g;
}

/** Perkiraan luas satu sel 0,1° (km²) di lintang tertentu. */
export function cellAreaKm2(lat: number, sizeDeg = 0.1): number {
  const kmPerDeg = 111.32;
  return sizeDeg * kmPerDeg * (sizeDeg * kmPerDeg * Math.cos((lat * Math.PI) / 180));
}

export type CellConcentration = {
  cellCount: number;
  areaKm2: number;
  /** Porsi aktivitas dari 10 lokasi teratas (0–1). */
  top10Share: number;
  /** Jumlah lokasi teratas yang bersama-sama menyumbang ≥ 50% aktivitas. */
  cellsFor50: number;
  /** cellsFor50 sebagai porsi dari seluruh lokasi beraktivitas (0–1). */
  cellsFor50Share: number;
  /** Titik kurva konsentrasi: x = porsi lokasi (teramai dulu), y = porsi aktivitas kumulatif. */
  curve: Array<{ x: number; y: number }>;
};

export function cellConcentration(cells: Pick<Cell, "lat" | "value">[]): CellConcentration | null {
  // Semua sel yang dikirim GFW dihitung (termasuk yang bernilai 0 setelah pembulatan), sama dengan tabel lokasi.
  const sorted = [...cells].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((s, c) => s + c.value, 0);
  if (sorted.length === 0 || !(total > 0)) return null;
  let acc = 0;
  let cellsFor50 = sorted.length;
  const curve: Array<{ x: number; y: number }> = [{ x: 0, y: 0 }];
  const marks = [0.01, 0.05, 0.1, 0.2, 0.3, 0.5, 0.75, 1];
  let mark = 0;
  sorted.forEach((c, i) => {
    acc += c.value;
    if (acc / total >= 0.5 && cellsFor50 === sorted.length && i + 1 < cellsFor50) cellsFor50 = i + 1;
    while (mark < marks.length && (i + 1) / sorted.length >= marks[mark]) {
      curve.push({ x: marks[mark], y: acc / total });
      mark += 1;
    }
  });
  const top10 = sorted.slice(0, 10).reduce((s, c) => s + c.value, 0);
  return {
    cellCount: sorted.length,
    areaKm2: sorted.reduce((s, c) => s + cellAreaKm2(c.lat), 0),
    top10Share: top10 / total,
    cellsFor50,
    cellsFor50Share: cellsFor50 / sorted.length,
    curve,
  };
}

/** Luas poligon GeoJSON (km²) pada bola (rumus selisih bujur × jumlah sinus lintang). */
export function geometryAreaKm2(geometry: { type: string; coordinates: unknown }): number {
  const R = 6371.0088;
  const rad = Math.PI / 180;
  const ringArea = (ring: number[][]) => {
    let sum = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [lon1, lat1] = ring[i];
      const [lon2, lat2] = ring[i + 1];
      sum += (lon2 - lon1) * rad * (2 + Math.sin(lat1 * rad) + Math.sin(lat2 * rad));
    }
    return Math.abs((sum * R * R) / 2);
  };
  const polygonArea = (rings: number[][][]) => rings.reduce((s, ring, i) => s + (i === 0 ? ringArea(ring) : -ringArea(ring)), 0);
  if (geometry.type === "Polygon") return polygonArea(geometry.coordinates as number[][][]);
  if (geometry.type === "MultiPolygon") return (geometry.coordinates as number[][][][]).reduce((s, p) => s + polygonArea(p), 0);
  return 0;
}
