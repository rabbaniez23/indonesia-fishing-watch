/**
 * Definisi metric PRD §9. Nilai null = tidak diketahui, tidak pernah diubah menjadi nol.
 */

export type Change =
  | { kind: "percent"; value: number }
  /** previous = 0 → "Persentase tidak dapat dihitung" (bukan infinite). */
  | { kind: "not-computable" }
  /** Salah satu nilai tidak diketahui. */
  | { kind: "unknown" };

/** changePercent = (current − previous) / previous × 100 */
export function changePercent(current: number | null, previous: number | null): Change {
  if (current === null || previous === null || !Number.isFinite(current) || !Number.isFinite(previous)) {
    return { kind: "unknown" };
  }
  if (previous === 0) return { kind: "not-computable" };
  return { kind: "percent", value: ((current - previous) / previous) * 100 };
}
