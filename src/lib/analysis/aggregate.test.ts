import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeReport, type ReportRow } from "@/lib/gfw/schemas";
import { aggregateCells, aggregateDaily, aggregateVessels, daysInRange } from "./aggregate";

function fixtureRows(name: string, metric: "hours" | "detections"): ReportRow[] {
  const f = JSON.parse(readFileSync(path.join(process.cwd(), "fixtures", "gfw", `${name}.json`), "utf8"));
  const entries = (f.response.body.entries as Array<Record<string, { sample: unknown[] } | unknown[]>>).map((entry) =>
    Object.fromEntries(Object.entries(entry).map(([k, v]) => [k, Array.isArray(v) ? v : v.sample])),
  );
  return normalizeReport({ ...f.response.body, entries }, metric).rows;
}

function row(partial: Partial<ReportRow>): ReportRow {
  return { date: "2026-09-26", flag: "IDN", lat: null, lon: null, value: 1, vesselIdCount: 1, vessel: null, ...partial };
}

describe("daysInRange", () => {
  it("end eksklusif, sesuai date-range GFW", () => {
    expect(daysInRange("2026-09-26", "2026-10-03")).toEqual([
      "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02",
    ]);
  });
});

describe("aggregateDaily", () => {
  it("fixture nyata: tanggal dari report harian masuk ke deret 7 hari", () => {
    const result = aggregateDaily(fixtureRows("11-report-fishing-daily-aggregated", "hours"), "hours", "2026-09-26", "2026-10-03");
    expect(result.series).toHaveLength(7);
    const sum = result.series.reduce((s, p) => s + (p.value ?? 0), 0);
    expect(result.total).toBeCloseTo(sum, 4);
  });

  it("hari tanpa baris = null (bukan nol); bendera kosong = kelompok tidak diketahui", () => {
    const result = aggregateDaily(
      [row({ date: "2026-09-26", value: 2 }), row({ date: "2026-09-26", flag: null, value: 1 }), row({ date: "2026-09-28", value: 0 })],
      "hours",
      "2026-09-26",
      "2026-09-29",
    );
    expect(result.series).toEqual([
      { date: "2026-09-26", value: 3 },
      { date: "2026-09-27", value: null },
      { date: "2026-09-28", value: 0 },
    ]);
    expect(result.daysWithoutRows).toEqual(["2026-09-27"]);
    expect(result.flagTotals).toContainEqual({ flag: null, value: 1 });
    expect(result.latestObservationDate).toBe("2026-09-26");
  });

  it("tanpa baris sama sekali → total null, bukan 0", () => {
    expect(aggregateDaily([], "hours", "2026-09-26", "2026-09-28").total).toBeNull();
  });
});

describe("aggregateCells", () => {
  it("menjumlah nilai lintas bendera per sel dan menyimpan rincian", () => {
    const result = aggregateCells(
      [row({ lat: 3, lon: 100.3, value: 5, flag: "IDN" }), row({ lat: 3, lon: 100.3, value: 2, flag: "MYS" }), row({ lat: -1, lon: 110, value: 1 })],
      "hours",
    );
    expect(result.cellCount).toBe(2);
    expect(result.cells[0]).toMatchObject({ lat: 3, lon: 100.3, value: 7 });
    expect(result.cells[0].byFlag[0]).toEqual(["IDN", 5, 1]);
    expect(result.total).toBe(8);
  });

  it("fixture nyata fishing effort terbaca sebagai sel 0,1°", () => {
    const result = aggregateCells(fixtureRows("08-report-fishing-effort", "hours"), "hours");
    expect(result.cellCount).toBeGreaterThan(0);
    expect(result.resolutionDeg).toBe(0.1);
  });
});

describe("aggregateVessels", () => {
  it("fixture nyata: jumlah unik = jumlah vesselId berbeda, observasi terakhir = exitTimestamp maks", () => {
    const rows = fixtureRows("12-report-fishing-vessels-aggregated", "hours");
    const result = aggregateVessels(rows, "hours");
    expect(result.uniqueVesselIds).toBe(new Set(rows.map((r) => r.vessel?.vesselId)).size);
    const maxExit = rows.map((r) => r.vessel!.exitTimestamp!).sort().at(-1);
    expect(result.latestObservationAt).toBe(maxExit);
    expect(result.topVessels[0].value).toBeGreaterThanOrEqual(result.topVessels.at(-1)!.value);
  });

  it("kapal yang sama di beberapa baris dihitung sekali; baris tanpa ID dipisah", () => {
    const vessel = { vesselId: "a1", shipName: "X", mmsi: "1", imo: null, callsign: null, geartype: null, vesselType: null, entryTimestamp: null, exitTimestamp: null };
    const result = aggregateVessels([row({ vessel, value: 1 }), row({ vessel, value: 2 }), row({ vessel: null, value: 4 })], "detections");
    expect(result.uniqueVesselIds).toBe(1);
    expect(result.topVessels[0].value).toBe(3);
    expect(result.rowsWithoutVesselId).toBe(1);
    expect(result.total).toBe(7);
  });
});
