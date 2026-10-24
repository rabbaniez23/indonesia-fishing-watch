import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getDb, newId, nowIso, transaction } from "@/lib/db";
import { getResearchDatasetById, getResearchDatasetContent } from "./datasets";
import { parseCsvRows } from "./validator";
import type { CustomMapLayer } from "./types";

type LayerRow = {
  id: string;
  dataset_id: string;
  dataset_name: string;
  name: string;
  description: string | null;
  layer_type: "point" | "line" | "polygon";
  color: string;
  stroke_color: string | null;
  opacity: number;
  is_visible: number;
  geojson_path: string;
  created_by: string;
  creator_name: string;
  row_count: number;
  created_at: string;
  updated_at: string;
};

function rowToLayer(row: LayerRow): CustomMapLayer {
  return {
    id: row.id,
    datasetId: row.dataset_id,
    datasetName: row.dataset_name || "Dataset",
    name: row.name,
    description: row.description,
    layerType: row.layer_type,
    color: row.color,
    strokeColor: row.stroke_color,
    opacity: row.opacity,
    isVisible: Boolean(row.is_visible),
    featureCount: row.row_count || 0,
    createdBy: {
      id: row.created_by,
      name: row.creator_name || "Peneliti",
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type CreateLayerInput = {
  datasetId: string;
  name: string;
  description?: string;
  layerType: "point" | "line" | "polygon";
  color?: string;
  strokeColor?: string;
  opacity?: number;
  isVisible?: boolean;
  userId: string;
};

/**
 * Konversi CSV berkoordinat menjadi GeoJSON FeatureCollection
 */
function csvToGeoJson(rawCsv: string): string {
  const rows = parseCsvRows(rawCsv);
  if (rows.length < 2) {
    return JSON.stringify({ type: "FeatureCollection", features: [] });
  }

  const headers = rows[0].map((h, i) => h.trim() || `col_${i}`);
  const dataRows = rows.slice(1);

  const LAT_KEYWORDS = ["lat", "latitude", "lintang", "y"];
  const LON_KEYWORDS = ["lon", "lng", "longitude", "long", "bujur", "x"];

  let latIdx = -1;
  let lonIdx = -1;

  headers.forEach((h, idx) => {
    const clean = h.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (latIdx === -1 && LAT_KEYWORDS.some((kw) => clean === kw || clean.includes(kw))) latIdx = idx;
    if (lonIdx === -1 && LON_KEYWORDS.some((kw) => clean === kw || clean.includes(kw))) lonIdx = idx;
  });

  const features = [];
  for (const row of dataRows) {
    if (latIdx === -1 || lonIdx === -1) continue;
    const lat = parseFloat(row[latIdx]);
    const lon = parseFloat(row[lonIdx]);
    if (Number.isNaN(lat) || Number.isNaN(lon)) continue;

    const properties: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      properties[h] = row[idx] ?? "";
    });

    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [lon, lat],
      },
      properties,
    });
  }

  return JSON.stringify({ type: "FeatureCollection", features });
}

export function createCustomLayer(input: CreateLayerInput): CustomMapLayer {
  const dataset = getResearchDatasetById(input.datasetId);
  if (!dataset) throw new Error("Dataset riset tidak ditemukan.");

  const raw = getResearchDatasetContent(input.datasetId);
  if (!raw) throw new Error("File dataset fisik tidak ditemukan.");

  const db = getDb();
  const id = newId();
  const now = nowIso();

  // Tentukan path geojson siap pakai
  const uploadDir = path.join(process.cwd(), "data", "research-uploads");
  const layerGeoJsonFileName = `layer-${id}.geojson`;
  const layerGeoJsonPath = path.join(uploadDir, layerGeoJsonFileName);

  if (raw.fileType === "geojson" || raw.fileType === "json") {
    writeFileSync(layerGeoJsonPath, raw.content);
  } else {
    // CSV -> Convert to GeoJSON
    const converted = csvToGeoJson(raw.content);
    writeFileSync(layerGeoJsonPath, converted);
  }

  const color = input.color || "#166534";
  const opacity = input.opacity !== undefined ? input.opacity : 0.8;
  const isVisible = input.isVisible !== undefined ? (input.isVisible ? 1 : 0) : 1;

  transaction(db, () => {
    db.prepare(`
      INSERT INTO custom_map_layers (
        id, dataset_id, name, description, layer_type, color, stroke_color,
        opacity, is_visible, geojson_path, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.datasetId,
      input.name,
      input.description || null,
      input.layerType,
      color,
      input.strokeColor || null,
      opacity,
      isVisible,
      layerGeoJsonFileName,
      input.userId,
      now,
      now,
    );

    db.prepare(`
      INSERT INTO audit_entries (id, actor_id, action, entity_type, entity_id, changes_json, occurred_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      newId(),
      input.userId,
      "layer:create",
      "custom_map_layer",
      id,
      JSON.stringify({ name: input.name, datasetId: input.datasetId, layerType: input.layerType }),
      now,
    );
  });

  return getCustomLayerById(id)!;
}

export function listCustomLayers(onlyVisible = false): CustomMapLayer[] {
  const db = getDb();
  let query = `
    SELECT l.*, d.name as dataset_name, d.row_count, u.name as creator_name
    FROM custom_map_layers l
    LEFT JOIN research_datasets d ON d.id = l.dataset_id
    LEFT JOIN users u ON u.id = l.created_by
  `;
  const params: number[] = [];
  if (onlyVisible) {
    query += " WHERE l.is_visible = 1";
  }
  query += " ORDER BY l.created_at DESC";

  const rows = db.prepare(query).all(...params) as LayerRow[];
  return rows.map(rowToLayer);
}

export function getCustomLayerById(id: string): CustomMapLayer | null {
  const db = getDb();
  const row = db
    .prepare(`
      SELECT l.*, d.name as dataset_name, d.row_count, u.name as creator_name
      FROM custom_map_layers l
      LEFT JOIN research_datasets d ON d.id = l.dataset_id
      LEFT JOIN users u ON u.id = l.created_by
      WHERE l.id = ?
    `)
    .get(id) as LayerRow | undefined;

  return row ? rowToLayer(row) : null;
}

export function updateCustomLayer(
  id: string,
  input: {
    name?: string;
    description?: string;
    color?: string;
    strokeColor?: string;
    opacity?: number;
    isVisible?: boolean;
  },
  userId: string,
): CustomMapLayer | null {
  const db = getDb();
  const existing = getCustomLayerById(id);
  if (!existing) return null;

  const now = nowIso();
  const name = input.name !== undefined ? input.name : existing.name;
  const description = input.description !== undefined ? input.description : existing.description;
  const color = input.color !== undefined ? input.color : existing.color;
  const strokeColor = input.strokeColor !== undefined ? input.strokeColor : existing.strokeColor;
  const opacity = input.opacity !== undefined ? input.opacity : existing.opacity;
  const isVisible = input.isVisible !== undefined ? (input.isVisible ? 1 : 0) : existing.isVisible ? 1 : 0;

  transaction(db, () => {
    db.prepare(`
      UPDATE custom_map_layers
      SET name = ?, description = ?, color = ?, stroke_color = ?, opacity = ?, is_visible = ?, updated_at = ?
      WHERE id = ?
    `).run(name, description, color, strokeColor, opacity, isVisible, now, id);

    db.prepare(`
      INSERT INTO audit_entries (id, actor_id, action, entity_type, entity_id, changes_json, occurred_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      newId(),
      userId,
      "layer:update",
      "custom_map_layer",
      id,
      JSON.stringify(input),
      now,
    );
  });

  return getCustomLayerById(id);
}

export function deleteCustomLayer(id: string, userId: string): boolean {
  const db = getDb();
  const existing = db.prepare("SELECT geojson_path FROM custom_map_layers WHERE id = ?").get(id) as
    | { geojson_path: string }
    | undefined;

  if (!existing) return false;

  transaction(db, () => {
    db.prepare("DELETE FROM custom_map_layers WHERE id = ?").run(id);
    db.prepare(`
      INSERT INTO audit_entries (id, actor_id, action, entity_type, entity_id, changes_json, occurred_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(newId(), userId, "layer:delete", "custom_map_layer", id, null, nowIso());
  });

  return true;
}

export function getCustomLayerGeoJsonContent(id: string): string | null {
  const db = getDb();
  const row = db.prepare("SELECT geojson_path FROM custom_map_layers WHERE id = ?").get(id) as
    | { geojson_path: string }
    | undefined;

  if (!row) return null;
  const uploadDir = path.join(process.cwd(), "data", "research-uploads");
  const filePath = path.join(uploadDir, row.geojson_path);

  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, "utf-8");
}
