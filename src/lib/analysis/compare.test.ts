import { describe, expect, it } from "vitest";
import type { Cell } from "./aggregate";
import { compareCells, comparisonPeriod, periodsHaveSameLength } from "./compare";
import { defaultFilter } from "./period";

const NOW = new Date("2026-10-13T08:00:00Z");
const cell = (lat: number, lon: number, value: number): Cell => ({ lat, lon, value, byFlag: [] });

describe("comparisonPeriod", () => {
  const active = defaultFilter("eez-idn", NOW); // 2026-09-08 .. 2026-10-07 (30 hari)

  it("default = periode sebelumnya dengan panjang sama", () => {
    const { period, error } = comparisonPeriod(active, null, NOW);
    expect(error).toBeNull();
    expect(period).toMatchObject({ from: "2026-08-09", to: "2026-09-07", days: 30 });
    expect(periodsHaveSameLength(active, period)).toBe(true);
  });

  it("periode pilihan: panjang mengikuti periode aktif", () => {
    const { period, error } = comparisonPeriod(active, "2026-06-01", NOW);
    expect(error).toBeNull();
    expect(period).toMatchObject({ from: "2026-06-01", to: "2026-06-30", end: "2026-07-01" });
  });

  it("tumpang tindih atau masa depan ditolak (kembali ke default dengan pesan)", () => {
    expect(comparisonPeriod(active, "2026-08-20", NOW).error).toMatch(/tumpang tindih/);
    expect(comparisonPeriod(active, "2026-10-08", NOW).error).toMatch(/sebelum hari ini/);
    expect(comparisonPeriod(active, "salah", NOW).error).toMatch(/tidak valid/);
  });
});

describe("compareCells", () => {
  it("kelas dihitung dari gabungan kedua periode (skala identik)", () => {
    const a = [cell(1, 100, 100), cell(1, 100.1, 10), cell(1, 100.2, 1)];
    const b = [cell(1, 100, 50), cell(2, 100, 500)];
    const r = compareCells(a, b, 10);
    expect(r.bins!.max).toBe(500);
    expect(r.rows[0]).toMatchObject({ lat: 1, lon: 100, valueA: 100, valueB: 50, rankA: 1 });
    // Nilai yang sama selalu jatuh ke kelas yang sama di kedua kolom.
    const same = compareCells([cell(0, 0, 50)], [cell(0, 0, 50)], 1);
    expect(same.rows[0].classA).toBe(same.rows[0].classB);
  });

  it("sel tanpa baris di periode B → null, bukan 0", () => {
    const r = compareCells([cell(1, 1, 5)], [], 5);
    expect(r.rows[0].valueB).toBeNull();
    expect(r.rows[0].classB).toBeNull();
  });
});
