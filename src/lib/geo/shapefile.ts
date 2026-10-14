/**
 * Konversi Shapefile poligon (.shp) → GeoJSON MultiPolygon, tanpa dependensi. Pure (menerima Buffer).
 *
 * Konvensi:
 * - Shapefile: ring luar searah jarum jam (signed area < 0), lubang berlawanan arah (ESRI Shapefile Technical Description).
 * - GeoJSON (RFC 7946 §3.1.6): ring luar berlawanan arah jarum jam, lubang searah → orientasi dibalik saat konversi.
 * - Koordinat diasumsikan lon/lat derajat (EPSG:4326); pemanggil memastikan bbox berada di rentang derajat.
 */

export type Position = [number, number];
export type Ring = Position[];
export type PolygonCoords = Ring[];

export type ShapefileParse = {
  shapeType: number;
  bbox: [number, number, number, number];
  outers: Ring[];
  holes: Ring[];
  pointCount: number;
};

const POLYGON_TYPES = new Set([5, 15, 25]);

export function parsePolygonShapefile(buf: Buffer): ShapefileParse {
  if (buf.readInt32BE(0) !== 9994) throw new Error("Bukan file .shp (kode file bukan 9994).");
  const fileLen = buf.readInt32BE(24) * 2;
  if (fileLen > buf.length) throw new Error("File .shp terpotong (panjang header melebihi ukuran file).");
  const shapeType = buf.readInt32LE(32);
  if (!POLYGON_TYPES.has(shapeType)) throw new Error(`Tipe geometri ${shapeType} bukan Polygon.`);
  const bbox: [number, number, number, number] = [buf.readDoubleLE(36), buf.readDoubleLE(44), buf.readDoubleLE(52), buf.readDoubleLE(60)];
  const outers: Ring[] = [];
  const holes: Ring[] = [];
  let pointCount = 0;
  let off = 100;
  while (off < fileLen) {
    const contentLen = buf.readInt32BE(off + 4) * 2;
    const c = off + 8;
    const recType = buf.readInt32LE(c);
    if (POLYGON_TYPES.has(recType)) {
      const nParts = buf.readInt32LE(c + 36);
      const nPoints = buf.readInt32LE(c + 40);
      const parts: number[] = [];
      for (let i = 0; i < nParts; i++) parts.push(buf.readInt32LE(c + 44 + i * 4));
      const base = c + 44 + nParts * 4;
      for (let p = 0; p < nParts; p++) {
        const end = p + 1 < nParts ? parts[p + 1] : nPoints;
        const ring: Ring = [];
        for (let i = parts[p]; i < end; i++) ring.push([buf.readDoubleLE(base + i * 16), buf.readDoubleLE(base + i * 16 + 8)]);
        if (ring.length < 4) continue;
        (signedArea(ring) < 0 ? outers : holes).push(ring);
      }
      pointCount += nPoints;
    }
    off += 8 + contentLen;
  }
  return { shapeType, bbox, outers, holes, pointCount };
}

/** Luas bertanda (derajat²); positif = berlawanan arah jarum jam. */
export function signedArea(ring: Ring): number {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return a / 2;
}

export function pointInRing([x, y]: Position, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Douglas–Peucker untuk ring tertutup (titik awal = akhir dipertahankan). Toleransi dalam derajat. */
export function simplifyRing(ring: Ring, tolerance: number): Ring {
  if (ring.length <= 4 || tolerance <= 0) return ring;
  return simplifyIndices(ring, tolerance).map((i) => ring[i]);
}

/** Indeks titik yang dipertahankan Douglas–Peucker (terurut, termasuk 0 dan n-1). */
export function simplifyIndices(ring: Ring, tolerance: number): number[] {
  const n = ring.length;
  if (n <= 4 || tolerance <= 0) return Array.from({ length: n }, (_, i) => i);
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  // Ring tertutup: pecah di titik terjauh dari titik awal agar DP punya dua segmen yang tidak berimpit.
  let far = 1;
  let farD = -1;
  for (let i = 1; i < n - 1; i++) {
    const d = (ring[i][0] - ring[0][0]) ** 2 + (ring[i][1] - ring[0][1]) ** 2;
    if (d > farD) {
      farD = d;
      far = i;
    }
  }
  keep[far] = 1;
  const tol2 = tolerance * tolerance;
  const stack: Array<[number, number]> = [
    [0, far],
    [far, n - 1],
  ];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const idx = farthest(ring, a, b);
    if (idx !== -1 && segDist2(ring[idx], ring[a], ring[b]) > tol2) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(i);
  return out;
}

/** Titik dengan jarak terbesar ke segmen a–b di antara a dan b (eksklusif); -1 bila tidak ada. */
function farthest(ring: Ring, a: number, b: number): number {
  let maxD = -1;
  let idx = -1;
  for (let i = a + 1; i < b; i++) {
    const d = segDist2(ring[i], ring[a], ring[b]);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  return idx;
}

function segDist2(p: Position, a: Position, b: Position): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const x = a[0] + t * dx - p[0];
  const y = a[1] + t * dy - p[1];
  return x * x + y * y;
}

/** Jumlah pasangan segmen tak-bersebelahan yang saling memotong di dalam/antar ring. */
export function countSelfIntersections(rings: Ring[]): number {
  let n = 0;
  for (const c of findIntersections(rings).values()) n += c;
  return n;
}

/**
 * Perpotongan segmen di dalam/antar ring. Hasil: Map "ringA:ringB" (A ≤ B) → jumlah perpotongan.
 * Indeks grid; tiap pasangan segmen hanya diuji di satu sel kanonik (pojok kiri-bawah irisan bbox) sehingga
 * tidak perlu himpunan pasangan yang sudah dilihat (hemat memori untuk ring ratusan ribu titik).
 */
export function findIntersections(rings: Ring[], segmentHits?: Map<number, Set<number>>): Map<string, number> {
  const cell = 0.25;
  const segA: Position[] = [];
  const segB: Position[] = [];
  const segRing: number[] = [];
  const segIdx: number[] = [];
  const range: Array<[number, number, number, number]> = [];
  const grid = new Map<string, number[]>();
  rings.forEach((r, ri) => {
    for (let i = 0; i < r.length - 1; i++) {
      const a = r[i];
      const b = r[i + 1];
      const k = segA.length;
      segA.push(a);
      segB.push(b);
      segRing.push(ri);
      segIdx.push(i);
      const x0 = Math.floor(Math.min(a[0], b[0]) / cell);
      const x1 = Math.floor(Math.max(a[0], b[0]) / cell);
      const y0 = Math.floor(Math.min(a[1], b[1]) / cell);
      const y1 = Math.floor(Math.max(a[1], b[1]) / cell);
      range.push([x0, x1, y0, y1]);
      for (let x = x0; x <= x1; x++)
        for (let y = y0; y <= y1; y++) {
          const key = `${x},${y}`;
          const list = grid.get(key);
          if (list) list.push(k);
          else grid.set(key, [k]);
        }
    }
  });
  const out = new Map<string, number>();
  for (const [key, list] of grid) {
    const [cx, cy] = key.split(",").map(Number);
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const q = list[j];
        const [px0, , py0] = range[p];
        const [qx0, , qy0] = range[q];
        if (Math.max(px0, qx0) !== cx || Math.max(py0, qy0) !== cy) continue; // bukan sel kanonik
        const ra = segRing[p];
        const rb = segRing[q];
        if (ra === rb) {
          const n = rings[ra].length - 1;
          const d = Math.abs(segIdx[p] - segIdx[q]);
          if (d <= 1 || d === n - 1) continue; // segmen bersebelahan
        }
        if (segmentsCross(segA[p], segB[p], segA[q], segB[q])) {
          const k = ra <= rb ? `${ra}:${rb}` : `${rb}:${ra}`;
          out.set(k, (out.get(k) ?? 0) + 1);
          if (segmentHits) {
            for (const [r, si] of [
              [ra, segIdx[p]],
              [rb, segIdx[q]],
            ] as const) {
              const set = segmentHits.get(r);
              if (set) set.add(si);
              else segmentHits.set(r, new Set([si]));
            }
          }
        }
      }
    }
  }
  return out;
}

function orient(a: Position, b: Position, c: Position) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function segmentsCross(a: Position, b: Position, c: Position, d: Position) {
  const d1 = orient(c, d, a);
  const d2 = orient(c, d, b);
  const d3 = orient(a, b, c);
  const d4 = orient(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

export type ConvertOptions = {
  /** Toleransi Douglas–Peucker (derajat). */
  tolerance: number;
  /** Lubang (pulau) lebih kecil dari luas ini (derajat²) dilebur ke poligon. */
  minHoleArea: number;
};

export type ConvertResult = {
  geometry: { type: "MultiPolygon"; coordinates: PolygonCoords[] };
  stats: {
    pointsIn: number;
    pointsOut: number;
    outers: number;
    holesIn: number;
    holesKept: number;
    holesDroppedSmall: number;
    holesOrphan: number;
    selfIntersections: number;
    /** Jumlah titik asli yang dikembalikan untuk menghilangkan perpotongan. */
    repairedRings: number;
    /** Pulau yang dilebur karena tetap memotong batas setelah perbaikan. */
    holesMerged: number;
    /** Ring luar berluas ≈ 0 (< 1e-4 derajat² ≈ 1,2 km²) yang dibuang. */
    outersDropped: number;
  };
};

/** Pasangkan lubang ke ring luar yang memuatnya, sederhanakan, lalu tulis dengan orientasi RFC 7946. */
export function toMultiPolygon(parsed: ShapefileParse, opts: ConvertOptions): ConvertResult {
  // Ring luar berluas ≈ 0 (serpihan digitasi) dibuang; tercatat di statistik.
  const outersKept = parsed.outers.filter((r) => Math.abs(signedArea(r)) >= OUTER_MIN_AREA);
  const polys: Array<{ outer: Ring; holes: Ring[] }> = outersKept.map((outer) => ({ outer, holes: [] }));
  let dropped = 0;
  let orphan = 0;
  for (const hole of parsed.holes) {
    if (Math.abs(signedArea(hole)) < opts.minHoleArea) {
      dropped++;
      continue;
    }
    const owner = polys.find((p) => pointInRing(hole[0], p.outer));
    if (owner) owner.holes.push(hole);
    else orphan++;
  }
  const coordinates: PolygonCoords[] = [];
  let pointsOut = 0;
  let holesKept = 0;
  let repairedRings = 0;
  let holesMerged = 0;
  for (const p of polys) {
    const sources = [p.outer, ...p.holes];
    const kept = sources.map((r) => simplifyIndices(r, opts.tolerance));
    const removed = new Set<number>();
    const area = sources.map((r) => Math.abs(signedArea(r)));
    const ringAt = (i: number) => kept[i].map((k) => sources[i][k]);
    // Perbaikan LOKAL perpotongan hasil penyederhanaan: untuk tiap segmen yang memotong, titik asli terjauh di
    // rentangnya dikembalikan (seperti satu langkah Douglas–Peucker tambahan) sampai bersih. Bila segmen yang
    // memotong sudah berupa segmen asli: pulau dilebur (yang lebih kecil); garis luar dibiarkan dan dilaporkan.
    for (let pass = 0; pass < 60; pass++) {
      const hits = new Map<number, Set<number>>();
      const pairs = findIntersections(
        sources.map((_, i) => (removed.has(i) ? [] : ringAt(i))),
        hits,
      );
      if (pairs.size === 0) break;
      let changed = false;
      for (const [ri, segs] of hits) {
        const add: number[] = [];
        for (const si of segs) {
          const idx = farthest(sources[ri], kept[ri][si], kept[ri][si + 1]);
          if (idx !== -1) add.push(idx);
        }
        if (add.length) {
          kept[ri] = [...new Set([...kept[ri], ...add])].sort((x, y) => x - y);
          repairedRings += add.length;
          changed = true;
        }
      }
      if (!changed) {
        // Tidak ada titik lagi yang bisa dikembalikan: lebur pulau yang terlibat.
        for (const key of pairs.keys()) {
          const [a, b] = key.split(":").map(Number);
          const victim = a === b ? (a === 0 ? -1 : a) : a === 0 ? b : b === 0 ? a : area[a] < area[b] ? a : b;
          if (victim > 0) removed.add(victim);
        }
        if ([...pairs.keys()].every((k) => k === "0:0")) break;
      }
    }
    const rings: Ring[] = [];
    sources.forEach((_, i) => {
      if (removed.has(i)) return;
      const r = ringAt(i);
      if (r.length < 4) return;
      const ccw = signedArea(r) > 0;
      const oriented = (i === 0) === ccw ? r : [...r].reverse();
      rings.push(oriented.map(([x, y]) => [round(x), round(y)] as Position));
    });
    if (rings.length === 0 || removed.has(0)) continue;
    holesKept += rings.length - 1;
    holesMerged += removed.size;
    pointsOut += rings.reduce((n, r) => n + r.length, 0);
    coordinates.push(rings);
  }
  const selfIntersections = coordinates.reduce((n, poly) => n + countSelfIntersections(poly), 0);
  return {
    geometry: { type: "MultiPolygon", coordinates },
    stats: {
      pointsIn: parsed.pointCount,
      pointsOut,
      outers: coordinates.length,
      holesIn: parsed.holes.length,
      holesKept,
      holesDroppedSmall: dropped,
      holesOrphan: orphan,
      selfIntersections,
      repairedRings,
      holesMerged,
      outersDropped: parsed.outers.length - outersKept.length,
    },
  };
}

const OUTER_MIN_AREA = 1e-4;

const round = (v: number) => Math.round(v * 1e5) / 1e5;
