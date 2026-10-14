import { describe, expect, it } from "vitest";
import { changePercent } from "./metrics";
import { defaultFilter, overlapsRecentDelay, parseFilter, previousPeriod, validateFilter } from "./period";

const NOW = new Date("2026-10-13T08:00:00Z");

describe("periode", () => {
  it("default: 30 hari UTC penuh, berakhir 5 hari sebelum hari ini", () => {
    const f = defaultFilter("eez-idn", NOW);
    expect(f).toMatchObject({ from: "2026-09-08", to: "2026-10-07", start: "2026-09-08", end: "2026-10-08", days: 30 });
  });

  it("rentang inklusif di UI → end eksklusif untuk report", () => {
    const r = validateFilter({ regionId: "eez-idn", from: "2026-09-01", to: "2026-09-30" }, NOW);
    expect(r.ok && r.filter).toMatchObject({ start: "2026-09-01", end: "2026-10-01", days: 30 });
  });

  it("menolak tanggal terbalik, > 90 hari, hari ini/masa depan, dan format salah", () => {
    expect(validateFilter({ regionId: "x", from: "2026-09-30", to: "2026-09-01" }, NOW).ok).toBe(false);
    expect(validateFilter({ regionId: "x", from: "2026-01-01", to: "2026-09-01" }, NOW).ok).toBe(false);
    expect(validateFilter({ regionId: "x", from: "2026-10-01", to: "2026-10-13" }, NOW).ok).toBe(false);
    expect(validateFilter({ regionId: "x", from: "2026-02-30", to: "2026-03-01" }, NOW).ok).toBe(false);
  });

  it("URL: wilayah tidak dikenal jatuh ke default; filter tidak valid memberi pesan", () => {
    const a = parseFilter({ region: "wpp-711" }, ["eez-idn"], NOW);
    expect(a.filter.regionId).toBe("eez-idn");
    expect(a.error).toMatch(/tidak tervalidasi/);
    const b = parseFilter({ region: "eez-idn", from: "2026-09-30", to: "2026-09-01" }, ["eez-idn"], NOW);
    expect(b.filter.from).toBe("2026-09-08");
    expect(b.error).toMatch(/sebelum tanggal mulai/);
    const c = parseFilter({ region: "eez-idn", from: "2026-09-01", to: "2026-09-07" }, ["eez-idn"], NOW);
    expect(c).toMatchObject({ error: null, filter: { days: 7, end: "2026-09-08" } });
  });

  it("periode pembanding: panjang sama, tepat sebelumnya", () => {
    const f = defaultFilter("eez-idn", NOW);
    expect(previousPeriod(f)).toMatchObject({ from: "2026-08-09", to: "2026-09-07", start: "2026-08-09", end: "2026-09-08", days: 30 });
  });

  it("menandai periode yang menyentuh rentang keterlambatan data", () => {
    expect(overlapsRecentDelay(defaultFilter("x", NOW), NOW)).toBe(false);
    const r = validateFilter({ regionId: "x", from: "2026-10-01", to: "2026-10-10" }, NOW);
    expect(r.ok && overlapsRecentDelay(r.filter, NOW)).toBe(true);
  });
});

describe("changePercent (PRD §9)", () => {
  it("rumus standar", () => {
    expect(changePercent(150, 100)).toEqual({ kind: "percent", value: 50 });
    expect(changePercent(50, 100)).toEqual({ kind: "percent", value: -50 });
  });
  it("previous = 0 → tidak dapat dihitung, bukan infinite", () => {
    expect(changePercent(10, 0)).toEqual({ kind: "not-computable" });
  });
  it("nilai tidak diketahui → unknown, bukan 0", () => {
    expect(changePercent(null, 10)).toEqual({ kind: "unknown" });
    expect(changePercent(10, null)).toEqual({ kind: "unknown" });
  });
});
