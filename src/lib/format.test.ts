import { describe, expect, it } from "vitest";
import { EMPTY_VALUE, formatCount, formatDateTimeUTC, formatDateUTC, formatDuration, formatHours, formatPercent } from "./format";

describe("format Indonesia", () => {
  it("memakai titik ribuan dan koma desimal", () => {
    expect(formatHours(1234567.89)).toBe("1.234.567,9");
    expect(formatCount(1500)).toBe("1.500");
  });

  it("null/NaN menjadi tanda kosong, bukan nol", () => {
    expect(formatHours(null)).toBe(EMPTY_VALUE);
    expect(formatCount(undefined)).toBe(EMPTY_VALUE);
    expect(formatHours(Number.NaN)).toBe(EMPTY_VALUE);
    expect(formatHours(0)).toBe("0");
  });

  it("persentase bertanda dan tidak infinite", () => {
    expect(formatPercent(12.34)).toBe("+12,3%");
    expect(formatPercent(-5)).toBe("−5%");
    expect(formatPercent(Number.POSITIVE_INFINITY)).toBe(EMPTY_VALUE);
  });

  it("tanggal memakai hari UTC", () => {
    // 23:30 UTC tanggal 13 tetap tanggal 13 walau zona lokal WIB sudah tanggal 14.
    expect(formatDateUTC("2026-10-13T23:30:00Z")).toBe("13 Okt 2026");
    expect(formatDateTimeUTC("2026-10-13T08:30:00Z")).toBe("13 Okt 2026, 08.30 UTC");
  });
});


describe("formatDuration", () => {
  it("menit, jam, hari", () => {
    expect(formatDuration(0.5)).toBe("30 menit");
    expect(formatDuration(20.25)).toBe("20,3 jam");
    expect(formatDuration(167)).toBe("6 hari 23 jam");
    expect(formatDuration(null)).toBe("—");
  });
});
