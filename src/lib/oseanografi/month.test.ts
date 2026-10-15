import { describe, expect, it } from "vitest";
import { dominantMonth, oceanFrame } from "./month";
import type { OceanVarMeta } from "./types";

const base = { unit: "", log: false, arrows: false, dataset: "", product: "" };
const sst: OceanVarMeta = { ...base, key: "sst", label: "Suhu", kind: "series", period: { climatology: [2012, 2025] } };
const wind: OceanVarMeta = { ...base, key: "wind", label: "Angin", kind: "year", period: { year: 2025 } };
const wave: OceanVarMeta = { ...base, key: "wave", label: "Gelombang", kind: "climatology", period: {} };

describe("dominantMonth", () => {
  it("memilih bulan dengan hari terbanyak di periode", () => {
    expect(dominantMonth("2026-08-20", "2026-09-18")).toBe("2026-09");
    expect(dominantMonth("2026-08-01", "2026-08-31")).toBe("2026-08");
    expect(dominantMonth("2025-12-20", "2026-01-05")).toBe("2025-12");
  });
  it("seri → bulan lebih awal; input rusak → bulan awal", () => {
    expect(dominantMonth("2026-01-30", "2026-02-02")).toBe("2026-01");
    expect(dominantMonth("2026-03-10", "2026-03-01")).toBe("2026-03");
  });
});

describe("oceanFrame", () => {
  it("rata-rata bulan kalender untuk deret", () => {
    expect(oceanFrame(sst, "2025-12", "2026-08")).toEqual({ frame: "8", label: "Agustus · rata-rata 2012–2025" });
  });
  it("data bulan itu bila sama dengan bulan terbaru", () => {
    expect(oceanFrame(sst, "2025-12", "2025-12").frame).toBe("latest");
  });
  it("tahun contoh dan klimatologi model", () => {
    expect(oceanFrame(wind, null, "2026-01").label).toBe("Januari 2025 (contoh satu tahun)");
    expect(oceanFrame(wave, null, "2026-07")).toEqual({ frame: "7", label: "Juli · klimatologi model" });
  });
});
