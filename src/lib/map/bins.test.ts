import { describe, expect, it } from "vitest";
import { classIndex, quantileBins } from "./bins";

describe("quantileBins", () => {
  it("5 kelas kuantil dari nilai positif, batas naik", () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    const bins = quantileBins(values, 5)!;
    expect(bins.classes).toBe(5);
    expect(bins.thresholds).toEqual([21, 41, 61, 81]);
    expect(bins.min).toBe(1);
    expect(bins.max).toBe(100);
  });

  it("nilai nol/negatif/NaN diabaikan; tanpa nilai positif → null", () => {
    expect(quantileBins([0, 0, Number.NaN, -1], 5)).toBeNull();
  });

  it("batas duplikat digabung (tidak membuat kelas kosong)", () => {
    const bins = quantileBins([1, 1, 1, 1, 1, 1, 1, 1, 1, 50], 5, true)!;
    expect(bins.thresholds).toEqual([]);
    expect(bins.classes).toBe(1);
  });

  it("classIndex memetakan nilai ke kelas", () => {
    const bins = quantileBins(Array.from({ length: 100 }, (_, i) => i + 1), 5)!;
    expect(classIndex(1, bins)).toBe(0);
    expect(classIndex(21, bins)).toBe(1);
    expect(classIndex(100, bins)).toBe(4);
  });
});
