import { createHash } from "node:crypto";
import { z } from "zod";
import { getDb, nowIso } from "@/lib/db";
import { geometryAreaKm2 } from "@/lib/analysis/stats";
import type { AreaGeometry, AreaRef } from "@/lib/gfw/adapters";

/**
 * Katalog wilayah cakupan. Pilot memakai ZEE Indonesia dari GFW (public-eez-areas id 8492, terverifikasi
 * lewat contract check). WPPNRI belum tersedia: per PRD §6.3 tidak dibuat dari kotak lon/lat atau perkiraan.
 */

export type RegionSummary = {
  id: string;
  code: string;
  name: string;
  type: "eez" | "wpp" | "national";
  gfwRegion: { dataset: "public-eez-areas"; id: number } | null;
  /** Dapat dianalisis: region GFW tervalidasi, atau poligon WPP yang diimpor (dikirim sebagai geometri). */
  analyzable: boolean;
  geometryHash: string;
  bbox: [number, number, number, number];
  crs: string;
  source: string;
  sourceVersion: string | null;
  sourceFetchedAt: string | null;
  validatedAt: string;
  notes: string | null;
};

type RegionRow = {
  id: string;
  code: string;
  name: string;
  type: RegionSummary["type"];
  gfw_region_dataset: string | null;
  gfw_region_id: number | null;
  geometry_hash: string;
  bbox_json: string;
  crs: string;
  source: string;
  source_version: string | null;
  source_fetched_at: string | null;
  validated_at: string;
  notes: string | null;
};

function toSummary(row: RegionRow): RegionSummary {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type,
    gfwRegion:
      row.gfw_region_dataset === "public-eez-areas" && row.gfw_region_id !== null
        ? { dataset: "public-eez-areas", id: row.gfw_region_id }
        : null,
    analyzable: (row.gfw_region_dataset === "public-eez-areas" && row.gfw_region_id !== null) || row.type === "wpp",
    geometryHash: row.geometry_hash,
    bbox: JSON.parse(row.bbox_json),
    crs: row.crs,
    source: row.source,
    sourceVersion: row.source_version,
    sourceFetchedAt: row.source_fetched_at,
    validatedAt: row.validated_at,
    notes: row.notes,
  };
}

const SUMMARY_COLUMNS =
  "id, code, name, type, gfw_region_dataset, gfw_region_id, geometry_hash, bbox_json, crs, source, source_version, source_fetched_at, validated_at, notes";

export function listRegions(): RegionSummary[] {
  return (getDb().prepare(`SELECT ${SUMMARY_COLUMNS} FROM regions ORDER BY type, code`).all() as RegionRow[]).map(toSummary);
}

export function getRegion(id: string): RegionSummary | null {
  const row = getDb().prepare(`SELECT ${SUMMARY_COLUMNS} FROM regions WHERE id = ?`).get(id) as RegionRow | undefined;
  return row ? toSummary(row) : null;
}

/** Cakupan query GFW untuk wilayah: region GFW bila ada, selain itu poligon tersimpan (WPP). */
export function regionArea(region: RegionSummary): AreaRef | null {
  if (region.gfwRegion) return { region: region.gfwRegion };
  if (!region.analyzable) return null;
  const fc = getRegionGeoJson(region.id) as { features?: Array<{ geometry?: AreaGeometry }> } | null;
  const geometry = fc?.features?.[0]?.geometry;
  return geometry ? { geometry, geometryHash: region.geometryHash } : null;
}

export function getRegionGeoJson(id: string): unknown | null {
  const row = getDb().prepare("SELECT geojson FROM regions WHERE id = ?").get(id) as { geojson: string } | undefined;
  return row ? JSON.parse(row.geojson) : null;
}

const areaMemo = new Map<string, number>();

/** Perkiraan luas laut wilayah (km², geometri pada bola). Di-memo per hash geometri. */
export function regionAreaKm2(region: RegionSummary): number | null {
  const memo = areaMemo.get(region.geometryHash);
  if (memo !== undefined) return memo;
  const fc = getRegionGeoJson(region.id) as { features?: Array<{ geometry?: { type: string; coordinates: unknown } }> } | null;
  if (!fc?.features?.length) return null;
  const km2 = fc.features.reduce((s, f) => s + (f.geometry ? geometryAreaKm2(f.geometry) : 0), 0);
  areaMemo.set(region.geometryHash, km2);
  return km2;
}

// ---------------------------------------------------------------------------
// Validasi & impor
// ---------------------------------------------------------------------------

const position = z.tuple([z.number(), z.number()]).rest(z.number());
const ring = z.array(position).min(4);
const polygon = z.array(ring).min(1);
const geometrySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Polygon"), coordinates: polygon }),
  z.object({ type: z.literal("MultiPolygon"), coordinates: z.array(polygon).min(1) }),
]);
const featureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z
    .array(z.object({ type: z.literal("Feature"), properties: z.record(z.string(), z.unknown()).nullable(), geometry: geometrySchema }))
    .min(1),
});

export type GeometryCheck = { bbox: [number, number, number, number]; ringCount: number; pointCount: number };

/**
 * Validasi struktural: FeatureCollection Polygon/MultiPolygon, ring tertutup, koordinat lon/lat dalam rentang
 * EPSG:4326 (RFC 7946: GeoJSON memakai WGS84, urutan longitude, latitude).
 */
export function validateGeoJson(json: unknown): { collection: z.infer<typeof featureCollectionSchema>; check: GeometryCheck } {
  const collection = featureCollectionSchema.parse(json);
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  let ringCount = 0, pointCount = 0;
  for (const feature of collection.features) {
    const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    for (const poly of polygons) {
      for (const r of poly) {
        ringCount += 1;
        const [firstLon, firstLat] = r[0];
        const [lastLon, lastLat] = r[r.length - 1];
        if (firstLon !== lastLon || firstLat !== lastLat) throw new Error("Ring poligon tidak tertutup.");
        for (const [lon, lat] of r) {
          if (lon < -180 || lon > 180 || lat < -90 || lat > 90) throw new Error("Koordinat di luar rentang EPSG:4326.");
          pointCount += 1;
          minLon = Math.min(minLon, lon);
          maxLon = Math.max(maxLon, lon);
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
        }
      }
    }
  }
  return { collection, check: { bbox: [minLon, minLat, maxLon, maxLat], ringCount, pointCount } };
}

export const EEZ_IDN = {
  id: "eez-idn",
  code: "EEZ-IDN",
  name: "ZEE Indonesia",
  gfwRegionId: 8492,
} as const;

/**
 * Impor geometri ZEE Indonesia yang dikirim GFW di `metadata.geometry` respons Events (region public-eez-areas 8492).
 * Properti sumber (ISO3, MRGID_EEZ) diperiksa agar file lain tidak tertukar.
 */
export function importEezIndonesia(geojsonText: string, sourceFetchedAt: string | null): RegionSummary {
  const { collection, check } = validateGeoJson(JSON.parse(geojsonText));
  const props = collection.features[0].properties ?? {};
  if (props.ISO3 !== "IDN" || props.MRGID_EEZ !== EEZ_IDN.gfwRegionId) {
    throw new Error(`Properti geometri tidak cocok (ISO3=${String(props.ISO3)}, MRGID_EEZ=${String(props.MRGID_EEZ)}).`);
  }
  const hash = createHash("sha256").update(geojsonText).digest("hex");
  getDb()
    .prepare(
      `INSERT INTO regions (id, code, name, type, gfw_region_dataset, gfw_region_id, geojson, geometry_hash, bbox_json, crs,
         source, source_version, source_fetched_at, validated_at, notes)
       VALUES (?, ?, ?, 'eez', 'public-eez-areas', ?, ?, ?, ?, 'EPSG:4326', ?, NULL, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET geojson = excluded.geojson, geometry_hash = excluded.geometry_hash,
         bbox_json = excluded.bbox_json, source_fetched_at = excluded.source_fetched_at,
         validated_at = excluded.validated_at, notes = excluded.notes`,
    )
    .run(
      EEZ_IDN.id,
      EEZ_IDN.code,
      EEZ_IDN.name,
      EEZ_IDN.gfwRegionId,
      geojsonText,
      hash,
      JSON.stringify(check.bbox),
      "Global Fishing Watch API — geometri region public-eez-areas id 8492 (atribut MRGID_EEZ 8492, Marine Regions)",
      sourceFetchedAt,
      nowIso(),
      `Validasi struktural: ${check.ringCount} ring, ${check.pointCount} titik. Versi layer GFW tidak disebutkan provider. ` +
        "ZEE tidak identik dengan WPPNRI; bukan dokumen batas resmi pemerintah.",
    );
  return getRegion(EEZ_IDN.id)!;
}

/** Nama perairan WPP-NRI (lampiran Permen KP No. 18/2014). Kode diambil dari nama file Shapefile. */
export const WPP_NAMES: Record<string, string> = {
  "571": "Selat Malaka dan Laut Andaman",
  "572": "Samudra Hindia barat Sumatra dan Selat Sunda",
  "573": "Samudra Hindia selatan Jawa hingga Nusa Tenggara, Laut Sawu, dan Laut Timor bagian barat",
  "711": "Selat Karimata, Laut Natuna, dan Laut Natuna Utara",
  "712": "Laut Jawa",
  "713": "Selat Makassar, Teluk Bone, Laut Flores, dan Laut Bali",
  "714": "Teluk Tolo dan Laut Banda",
  "715": "Teluk Tomini, Laut Maluku, Laut Halmahera, Laut Seram, dan Teluk Berau",
  "716": "Laut Sulawesi dan utara Pulau Halmahera",
  "717": "Teluk Cenderawasih dan Samudra Pasifik",
  "718": "Laut Aru, Laut Arafura, dan Laut Timor bagian timur",
};

/**
 * Impor satu poligon WPP (hasil `scripts/convert-wpp.ts`). Tanpa region GFW: query dikirim sebagai geometri.
 * Sumber file tidak dicatat (permintaan pengguna); CRS diasumsikan EPSG:4326 karena .prj tidak tersedia.
 */
export function importWppRegion(code: string, geojsonText: string, notes: string): RegionSummary {
  if (!WPP_NAMES[code]) throw new Error(`Kode WPP tidak dikenal: ${code}`);
  const { check } = validateGeoJson(JSON.parse(geojsonText));
  const [minLon, minLat, maxLon, maxLat] = check.bbox;
  if (minLon < 85 || maxLon > 145 || minLat < -16 || maxLat > 12) throw new Error(`bbox WPP ${code} di luar perairan Indonesia: ${check.bbox.join(", ")}`);
  const hash = createHash("sha256").update(geojsonText).digest("hex");
  const id = `wpp-${code}`;
  getDb()
    .prepare(
      `INSERT INTO regions (id, code, name, type, gfw_region_dataset, gfw_region_id, geojson, geometry_hash, bbox_json, crs,
         source, source_version, source_fetched_at, validated_at, notes)
       VALUES (?, ?, ?, 'wpp', NULL, NULL, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, geojson = excluded.geojson, geometry_hash = excluded.geometry_hash,
         bbox_json = excluded.bbox_json, crs = excluded.crs, source = excluded.source,
         validated_at = excluded.validated_at, notes = excluded.notes`,
    )
    .run(
      id,
      `WPP-${code}`,
      `WPP ${code} · ${WPP_NAMES[code]}`,
      geojsonText,
      hash,
      JSON.stringify(check.bbox),
      "EPSG:4326 (diasumsikan; file .prj tidak ada)",
      "Shapefile WPP-RI (sumber tidak dicatat)",
      nowIso(),
      `${notes} Validasi struktural: ${check.ringCount} ring, ${check.pointCount} titik.`,
    );
  return getRegion(id)!;
}

/**
 * Catatan WPP yang batasnya melewati ZEE Indonesia versi GFW (public-eez-areas 8492). Dari uji sel 0,1°
 * apparent fishing 8 Sep–7 Okt 2026 (11 WPP mencakup 99,9% jam ZEE; tumpang tindih antar-WPP 60,8 jam).
 */
export const WPP_OUTSIDE_EEZ: Record<string, { share: number; flags: string }> = {
  "571": { share: 40, flags: "Malaysia" },
  "711": { share: 85, flags: "Vietnam" },
};
