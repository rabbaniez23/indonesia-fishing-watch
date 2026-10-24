import { beforeEach, describe, expect, it } from "vitest";
import { openDatabase, setDbForTesting } from "@/lib/db";
import { saveResearchDataset } from "./datasets";
import {
  createCustomLayer,
  deleteCustomLayer,
  getCustomLayerById,
  getCustomLayerGeoJsonContent,
  listCustomLayers,
  updateCustomLayer,
} from "./layers";
import { validateCsvContent, validateGeoJsonContent } from "./validator";

describe("custom map layers", () => {
  beforeEach(() => {
    const db = openDatabase(":memory:");
    setDbForTesting(db);
    // Masukkan dummy user
    db.prepare(`
      INSERT INTO users (id, email, name, role, password_hash, status, created_at, updated_at)
      VALUES ('u1', 'peneliti@kkp.go.id', 'Peneliti Maritim', 'analyst', 'hash', 'active', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z')
    `).run();
  });

  it("creates custom layer from GeoJSON dataset and lists it", () => {
    const geojson = JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [[[105, -2], [106, -2], [106, -3], [105, -3], [105, -2]]] },
          properties: { nama: "Kawasan Konservasi Laut A" },
        },
      ],
    });

    const validation = validateGeoJsonContent(geojson);
    const dataset = saveResearchDataset({
      name: "Batas Konservasi",
      category: "custom_layer",
      fileName: "konservasi.geojson",
      rawBuffer: Buffer.from(geojson),
      validation,
      userId: "u1",
    });

    const layer = createCustomLayer({
      datasetId: dataset.id,
      name: "Zona Konservasi A",
      description: "Zona perlindungan terumbu karang",
      layerType: "polygon",
      color: "#166534",
      opacity: 0.7,
      isVisible: true,
      userId: "u1",
    });

    expect(layer.id).toBeDefined();
    expect(layer.name).toBe("Zona Konservasi A");
    expect(layer.layerType).toBe("polygon");
    expect(layer.color).toBe("#166534");
    expect(layer.isVisible).toBe(true);

    const list = listCustomLayers();
    expect(list.length).toBe(1);
    expect(list[0].name).toBe("Zona Konservasi A");

    const content = getCustomLayerGeoJsonContent(layer.id);
    expect(content).toContain("Kawasan Konservasi Laut A");
  });

  it("creates point layer from CSV dataset with lat/lon", () => {
    const csv = `nama_pos,lat,lon\nPos Pengawasan 1,-3.5,108.2\nPos Pengawasan 2,-2.1,105.6`;
    const validation = validateCsvContent(csv);
    const dataset = saveResearchDataset({
      name: "Pos Pantau",
      category: "vessel_sightings",
      fileName: "pos.csv",
      rawBuffer: Buffer.from(csv),
      validation,
      userId: "u1",
    });

    const layer = createCustomLayer({
      datasetId: dataset.id,
      name: "Pos Pantau Maritim",
      layerType: "point",
      color: "#1D4ED8",
      opacity: 0.9,
      isVisible: true,
      userId: "u1",
    });

    expect(layer.layerType).toBe("point");
    const content = getCustomLayerGeoJsonContent(layer.id);
    expect(content).toContain("Point");
    expect(content).toContain("Pos Pengawasan 1");
  });

  it("updates and deletes custom layer", () => {
    const geojson = JSON.stringify({ type: "FeatureCollection", features: [] });
    const validation = validateGeoJsonContent(geojson);
    const dataset = saveResearchDataset({
      name: "Test",
      category: "other",
      fileName: "test.geojson",
      rawBuffer: Buffer.from(geojson),
      validation,
      userId: "u1",
    });

    const layer = createCustomLayer({
      datasetId: dataset.id,
      name: "Layer Test",
      layerType: "line",
      userId: "u1",
    });

    const updated = updateCustomLayer(
      layer.id,
      { color: "#E11D48", isVisible: false, name: "Layer Updated" },
      "u1",
    );
    expect(updated?.color).toBe("#E11D48");
    expect(updated?.isVisible).toBe(false);
    expect(updated?.name).toBe("Layer Updated");

    const deleted = deleteCustomLayer(layer.id, "u1");
    expect(deleted).toBe(true);

    const check = getCustomLayerById(layer.id);
    expect(check).toBeNull();
  });
});
