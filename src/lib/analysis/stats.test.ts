import { describe, expect, it } from "vitest";
import { fleetBreakdown, type VesselContribution } from "./aggregate";
import { cellAreaKm2, cellConcentration, describeSeries, flagGroups, geometryAreaKm2, median, movingAverage, stabilityLabel, weekdayPattern } from "./stats";

const vessel = (id: string, value: number, extra: Partial<VesselContribution> = {}): VesselContribution => ({
  vesselId: id,
  shipName: null,
  mmsi: null,
  imo: null,
  callsign: null,
  geartype: "TRAWLERS",
  vesselType: "FISHING",
  entryTimestamp: null,
  exitTimestamp: null,
  flag: "IDN",
  value,
  ...extra,
});

describe("describeSeries", () => {
  it("hari null tidak dihitung sebagai nol", () => {
    const s = describeSeries([
      { date: "2026-10-05", value: 10 },
      { date: "2026-10-06", value: null },
      { date: "2026-10-07", value: 30 },
    ])!;
    expect(s.days).toBe(2);
    expect(s.mean).toBe(20);
    expect(s.min).toEqual({ date: "2026-10-05", value: 10 });
    expect(s.max).toEqual({ date: "2026-10-07", value: 30 });
    expect(s.std).toBe(10);
    expect(s.cv).toBe(0.5);
  });
  it("semua null → null (bukan nol)", () => {
    expect(describeSeries([{ date: "2026-10-05", value: null }])).toBeNull();
  });
  it("median genap & ganjil", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
  it("label kestabilan", () => {
    expect(stabilityLabel(0.1)).toBe("Stabil");
    expect(stabilityLabel(0.2)).toBe("Cukup bervariasi");
    expect(stabilityLabel(0.5)).toBe("Sangat bervariasi");
    expect(stabilityLabel(null)).toBe("Tidak dapat dihitung");
  });
});

describe("weekdayPattern", () => {
  it("Senin pertama, rata-rata hanya dari hari bernilai (UTC)", () => {
    // 5 Okt 2026 = Senin, 12 Okt 2026 = Senin.
    const w = weekdayPattern([
      { date: "2026-10-05", value: 10 },
      { date: "2026-10-12", value: 20 },
      { date: "2026-10-11", value: null },
    ]);
    expect(w[0]).toEqual({ day: "Senin", mean: 15, days: 2 });
    expect(w[6]).toEqual({ day: "Minggu", mean: null, days: 0 });
  });
});

describe("movingAverage", () => {
  it("butuh minimal 4 titik dalam jendela 7 hari", () => {
    const series = [1, 2, 3, 4, 5].map((v, i) => ({ date: `2026-10-0${i + 1}`, value: v }));
    const ma = movingAverage(series);
    expect(ma[2].value).toBeNull();
    expect(ma[3].value).toBe(2.5);
  });
});

describe("flagGroups", () => {
  it("memisahkan IDN, bendera lain, tidak diketahui", () => {
    const g = flagGroups([
      { flag: "IDN", value: 70 },
      { flag: "MYS", value: 20 },
      { flag: "VNM", value: 5 },
      { flag: null, value: 5 },
    ]);
    expect(g).toEqual({ domestic: 70, foreign: 25, unknown: 5, total: 100, foreignFlags: 2 });
  });
});

describe("cellConcentration", () => {
  it("porsi 10 teratas, jumlah lokasi untuk 50%, kurva naik", () => {
    const cells = [50, 20, 10, 5, 5, 5, 5].map((value, i) => ({ lat: 0, value: i === 0 ? value : value }));
    const c = cellConcentration(cells)!;
    expect(c.cellCount).toBe(7);
    expect(c.cellsFor50).toBe(1);
    expect(c.top10Share).toBe(1);
    expect(c.curve.at(-1)).toEqual({ x: 1, y: 1 });
    for (let i = 1; i < c.curve.length; i++) expect(c.curve[i].y).toBeGreaterThanOrEqual(c.curve[i - 1].y);
  });
  it("sel 0,1° di khatulistiwa ±124 km², menyusut di lintang tinggi", () => {
    expect(cellAreaKm2(0)).toBeCloseTo(123.9, 0);
    expect(cellAreaKm2(10)).toBeLessThan(cellAreaKm2(0));
  });
  it("tanpa sel bernilai → null", () => {
    expect(cellConcentration([])).toBeNull();
  });
});

describe("geometryAreaKm2", () => {
  it("kotak 1° × 1° di khatulistiwa ≈ 12.364 km²", () => {
    const area = geometryAreaKm2({ type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] });
    expect(area).toBeGreaterThan(12_300);
    expect(area).toBeLessThan(12_400);
  });
  it("lubang mengurangi luas; MultiPolygon dijumlah", () => {
    const outer = [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]];
    const hole = [[0.5, 0.5], [0.5, 1.5], [1.5, 1.5], [1.5, 0.5], [0.5, 0.5]];
    const withHole = geometryAreaKm2({ type: "Polygon", coordinates: [outer, hole] });
    const full = geometryAreaKm2({ type: "Polygon", coordinates: [outer] });
    expect(withHole).toBeLessThan(full);
    expect(geometryAreaKm2({ type: "MultiPolygon", coordinates: [[outer], [outer]] })).toBeCloseTo(full * 2, 3);
  });
});

describe("fleetBreakdown", () => {
  const vessels = [
    vessel("a", 100, { geartype: "TRAWLERS" }),
    vessel("b", 30, { geartype: "SET_LONGLINES", flag: "MYS" }),
    vessel("c", 0.5, { geartype: null, flag: null }),
    vessel("d", 8),
  ];
  const f = fleetBreakdown(vessels, "hours");
  it("kelompok alat tangkap memakai seluruh kapal, kunci kosong = tidak diketahui", () => {
    expect(f.byGear[0]).toEqual({ key: "TRAWLERS", value: 108, vessels: 2 });
    expect(f.byGear.find((g) => g.key === null)).toEqual({ key: null, value: 0.5, vessels: 1 });
    expect(f.byFlag.map((g) => g.key)).toEqual(["IDN", "MYS", null]);
  });
  it("histogram jam: tiap kapal tepat satu kelompok", () => {
    expect(f.histogram.reduce((s, b) => s + b.vessels, 0)).toBe(4);
    expect(f.histogram.find((b) => b.lo === 0)!.vessels).toBe(1);
    expect(f.histogram.find((b) => b.lo === 72)!.vessels).toBe(1);
  });
  it("konsentrasi & median", () => {
    expect(f.top10Share).toBe(1);
    expect(f.top10PctShare).toBeCloseTo(100 / 138.5, 5);
    expect(f.medianPerVessel).toBe(19);
  });
});
