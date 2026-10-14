import { beforeEach, describe, expect, it } from "vitest";
import { openDatabase, setDbForTesting } from "@/lib/db";
import { importWppRegion, listRegions, regionArea } from "@/lib/regions";
import { buildReportQuery, reportIdentity, type AreaRef } from "./adapters";

const base = { dataset: "fishingEffort" as const, start: "2026-09-01", end: "2026-09-08", temporalResolution: "DAILY" as const, groupBy: "FLAG" as const, spatialAggregation: true };
const square = { type: "MultiPolygon" as const, coordinates: [[[[110, -6], [111, -6], [111, -5], [110, -5], [110, -6]]]] };

describe("report dengan poligon sendiri", () => {
  it("query tanpa region-*, identitas memuat hash poligon", () => {
    const a: AreaRef = { geometry: square, geometryHash: "aaa" };
    const b: AreaRef = { geometry: square, geometryHash: "bbb" };
    const q = buildReportQuery({ ...base, area: a });
    expect(q.some(([k]) => k.startsWith("region-"))).toBe(false);
    expect(reportIdentity({ ...base, area: a })).not.toEqual(reportIdentity({ ...base, area: b }));
  });

  it("region GFW: identitas = query (kompatibel dengan job lama)", () => {
    const area: AreaRef = { region: { dataset: "public-eez-areas", id: 8492 } };
    expect(reportIdentity({ ...base, area })).toEqual(buildReportQuery({ ...base, area }));
    expect(buildReportQuery({ ...base, area })).toContainEqual(["region-id", 8492]);
  });
});

describe("importWppRegion", () => {
  beforeEach(() => setDbForTesting(openDatabase(":memory:")));

  it("menyimpan WPP sebagai wilayah yang dapat dianalisis lewat geometri", () => {
    const text = JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", properties: { wpp: "712" }, geometry: square }] });
    const region = importWppRegion("712", text, "uji.");
    expect(region).toMatchObject({ id: "wpp-712", type: "wpp", gfwRegion: null, analyzable: true, name: "WPP 712 · Laut Jawa" });
    const area = regionArea(region);
    expect(area && "geometry" in area ? area.geometryHash : null).toBe(region.geometryHash);
    expect(listRegions().map((r) => r.id)).toContain("wpp-712");
  });

  it("menolak kode tak dikenal dan poligon di luar Indonesia", () => {
    const text = JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: square }] });
    expect(() => importWppRegion("999", text, "")).toThrow(/tidak dikenal/);
    const far = JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] } }] });
    expect(() => importWppRegion("571", far, "")).toThrow(/di luar perairan/);
  });
});
