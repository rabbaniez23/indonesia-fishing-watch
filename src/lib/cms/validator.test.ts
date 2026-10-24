import { describe, expect, it } from "vitest";
import { parseCsvRows, validateCsvContent, validateGeoJsonContent } from "./validator";

describe("parseCsvRows", () => {
  it("parses standard CSV with comma and CRLF", () => {
    const csv = "col1,col2\r\nval1,val2\r\nval3,val4";
    const parsed = parseCsvRows(csv);
    expect(parsed).toEqual([
      ["col1", "col2"],
      ["val1", "val2"],
      ["val3", "val4"],
    ]);
  });

  it("handles commas inside quotes", () => {
    const csv = 'name,coord\n"Kapal A, KM",105.2\n"Kapal B",106.3';
    const parsed = parseCsvRows(csv);
    expect(parsed).toEqual([
      ["name", "coord"],
      ["Kapal A, KM", "105.2"],
      ["Kapal B", "106.3"],
    ]);
  });
});

describe("validateCsvContent", () => {
  it("detects coordinates and counts valid rows", () => {
    const sample = `nama_kapal,latitude,longitude,tanggal
KM Bahari 01,3.45,108.20,2026-10-15
KM Laut Biru,-1.12,104.50,2026-10-16
KM Ikan Mas,invalid_coord,107.00,2026-10-17`;

    const result = validateCsvContent(sample);
    expect(result.valid).toBe(true);
    expect(result.rowCount).toBe(3);
    expect(result.summary.hasCoordinates).toBe(true);
    expect(result.summary.coordColumns).toEqual({ lat: "latitude", lon: "longitude" });
    expect(result.summary.validCoordinatesCount).toBe(2);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.summary.hasDate).toBe(true);
  });
});

describe("validateGeoJsonContent", () => {
  it("detects FeatureCollection and calculates bbox", () => {
    const geojson = JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [105.0, -2.5],
          },
          properties: {
            nama: "Zona Konservasi A",
            luas_ha: 1500,
          },
        },
      ],
    });

    const result = validateGeoJsonContent(geojson);
    expect(result.valid).toBe(true);
    expect(result.rowCount).toBe(1);
    expect(result.summary.hasCoordinates).toBe(true);
    expect(result.columns).toContain("nama");
    expect(result.columns).toContain("luas_ha");
  });
});
