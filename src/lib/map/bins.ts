/**
 * Kelas warna peta (DS §3.3, §8.4): maksimal 6 kelas, legenda menyebut "Skala kuantil" dan rentang.
 * Batas kelas dihitung dari snapshot yang sedang ditampilkan (bukan angka dekoratif tetap).
 */

export type Bins = {
  method: "quantile";
  /** Batas bawah kelas ke-2..n (ascending, unik). Kelas 1: [min, t0), kelas i: [t(i-1), t(i)), terakhir: [t(n-2), max]. */
  thresholds: number[];
  min: number;
  max: number;
  classes: number;
};

/** Pembulatan "rapi" agar label legenda mudah dibaca tanpa mengubah urutan. */
function niceRound(value: number, integer: boolean): number {
  if (integer) return Math.max(1, Math.round(value));
  if (value >= 100) return Math.round(value);
  if (value >= 10) return Math.round(value * 10) / 10;
  return Math.round(value * 100) / 100;
}

/**
 * Kuantil dari nilai > 0. Batas duplikat digabung sehingga jumlah kelas bisa kurang dari target
 * (mis. data dengan banyak nilai sama) — tidak mengarang kelas kosong.
 */
export function quantileBins(values: number[], classes = 5, integer = false): Bins | null {
  const positive = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (positive.length === 0) return null;
  const min = positive[0];
  const max = positive[positive.length - 1];
  const thresholds: number[] = [];
  for (let i = 1; i < classes; i++) {
    const q = positive[Math.min(positive.length - 1, Math.floor((i / classes) * positive.length))];
    const t = niceRound(q, integer);
    if (t > min && t <= max && (thresholds.length === 0 || t > thresholds[thresholds.length - 1])) thresholds.push(t);
  }
  return { method: "quantile", thresholds, min, max, classes: thresholds.length + 1 };
}

export function classIndex(value: number, bins: Bins): number {
  let i = 0;
  while (i < bins.thresholds.length && value >= bins.thresholds[i]) i++;
  return i;
}
