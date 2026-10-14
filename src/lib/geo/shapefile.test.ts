import { describe, expect, it } from "vitest";
import { countSelfIntersections, parsePolygonShapefile, signedArea, simplifyRing, toMultiPolygon, type Ring } from "./shapefile";

/** Bangun .shp Polygon minimal (satu record, beberapa ring) sesuai spesifikasi ESRI. */
function buildShp(rings: Ring[]): Buffer {
  const nPoints = rings.reduce((n, r) => n + r.length, 0);
  const contentLen = 44 + rings.length * 4 + nPoints * 16;
  const buf = Buffer.alloc(100 + 8 + contentLen);
  buf.writeInt32BE(9994, 0);
  buf.writeInt32BE(buf.length / 2, 24);
  buf.writeInt32LE(1000, 28);
  buf.writeInt32LE(5, 32);
  const all = rings.flat();
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].forEach((v, i) => buf.writeDoubleLE(v, 36 + i * 8));
  buf.writeInt32BE(1, 100);
  buf.writeInt32BE(contentLen / 2, 104);
  const c = 108;
  buf.writeInt32LE(5, c);
  buf.writeInt32LE(rings.length, c + 36);
  buf.writeInt32LE(nPoints, c + 40);
  let idx = 0;
  rings.forEach((r, i) => {
    buf.writeInt32LE(idx, c + 44 + i * 4);
    idx += r.length;
  });
  all.forEach(([x, y], i) => {
    buf.writeDoubleLE(x, c + 44 + rings.length * 4 + i * 16);
    buf.writeDoubleLE(y, c + 44 + rings.length * 4 + i * 16 + 8);
  });
  return buf;
}

// Ring luar searah jarum jam (konvensi Shapefile), lubang berlawanan.
const OUTER: Ring = [[110, -5], [110, 0], [115, 0], [115, -5], [110, -5]];
const BIG_HOLE: Ring = [[111, -4], [112, -4], [112, -3], [111, -3], [111, -4]];
const TINY_HOLE: Ring = [[113, -2], [113.01, -2], [113.01, -1.99], [113, -1.99], [113, -2]];

describe("parsePolygonShapefile", () => {
  it("membedakan ring luar & lubang dari orientasi", () => {
    const parsed = parsePolygonShapefile(buildShp([OUTER, BIG_HOLE, TINY_HOLE]));
    expect(parsed.outers).toHaveLength(1);
    expect(parsed.holes).toHaveLength(2);
    expect(parsed.bbox).toEqual([110, -5, 115, 0]);
  });

  it("menolak file bukan .shp", () => {
    expect(() => parsePolygonShapefile(Buffer.alloc(100))).toThrow(/9994/);
  });
});

describe("toMultiPolygon", () => {
  it("orientasi RFC 7946, lubang kecil dilebur, lubang besar dipertahankan", () => {
    const { geometry, stats } = toMultiPolygon(parsePolygonShapefile(buildShp([OUTER, BIG_HOLE, TINY_HOLE])), { tolerance: 0, minHoleArea: 0.001 });
    expect(geometry.coordinates).toHaveLength(1);
    const [outer, hole] = geometry.coordinates[0];
    expect(signedArea(outer)).toBeGreaterThan(0);
    expect(signedArea(hole)).toBeLessThan(0);
    expect(stats).toMatchObject({ holesKept: 1, holesDroppedSmall: 1, holesOrphan: 0, selfIntersections: 0 });
  });
});

describe("simplifyRing", () => {
  it("membuang titik di bawah toleransi, tetap tertutup", () => {
    const wiggly: Ring = [[0, 0], [1, 0.0001], [2, 0], [2, 2], [1, 2.0001], [0, 2], [0, 0]];
    const s = simplifyRing(wiggly, 0.01);
    expect(s.length).toBe(5);
    expect(s[0]).toEqual(s[s.length - 1]);
  });
});

describe("countSelfIntersections", () => {
  it("mendeteksi ring berbentuk angka 8", () => {
    expect(countSelfIntersections([[[0, 0], [2, 2], [2, 0], [0, 2], [0, 0]]])).toBeGreaterThan(0);
    expect(countSelfIntersections([OUTER])).toBe(0);
  });
});
