import "server-only";
import type { CellsResult } from "@/lib/analysis/aggregate";
import { getReportResult, type ReportResult } from "@/lib/analysis/report-jobs";
import { quantileBins, type Bins } from "./bins";
import { CELL_HALF_DEG, isMapLayerKey, MAP_LAYERS, type MapLayerKey } from "./layers";

/**
 * Data sel untuk peta dari snapshot report_results (kind=cells). Snapshot immutable → aman di-cache di memori.
 * Payload dikirim ringkas: [lat, lon, value, ...] agar ±35 ribu sel keberadaan tidak menjadi GeoJSON berat.
 */

export type MapCellsPayload = {
  resultId: string;
  layer: MapLayerKey;
  start: string;
  end: string;
  resolutionDeg: number;
  cellCount: number;
  total: number;
  bins: Bins | null;
  /** Flat: lat, lon, value berulang. */
  cells: number[];
  provenance: ReportResult["provenance"];
};

type Entry = { result: ReportResult & { payload: CellsResult }; compact: MapCellsPayload; index: Map<string, number> };

const cache = new Map<string, Entry>();
const MAX_ENTRIES = 6;

const key = (lat: number, lon: number) => `${lat.toFixed(2)},${lon.toFixed(2)}`;

function load(resultId: string): Entry | null {
  const hit = cache.get(resultId);
  if (hit) return hit;
  const result = getReportResult(resultId, true) as (ReportResult & { payload: CellsResult }) | null;
  if (!result || result.kind !== "cells" || !isMapLayerKey(result.datasetKey)) return null;
  const layer = result.datasetKey;
  const cells = result.payload.cells;
  const flat = new Array<number>(cells.length * 3);
  const index = new Map<string, number>();
  cells.forEach((c, i) => {
    flat[i * 3] = c.lat;
    flat[i * 3 + 1] = c.lon;
    flat[i * 3 + 2] = Math.round(c.value * 1000) / 1000;
    index.set(key(c.lat, c.lon), i);
  });
  const entry: Entry = {
    result,
    index,
    compact: {
      resultId,
      layer,
      start: result.start,
      end: result.end,
      resolutionDeg: result.payload.resolutionDeg,
      cellCount: result.payload.cellCount,
      total: result.payload.total,
      bins: quantileBins(cells.map((c) => c.value), 5, MAP_LAYERS[layer].format === "count"),
      cells: flat,
      provenance: result.provenance,
    },
  };
  cache.set(resultId, entry);
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  return entry;
}

export function getMapCells(resultId: string): MapCellsPayload | null {
  return load(resultId)?.compact ?? null;
}

export type CellDetail = {
  resultId: string;
  layer: MapLayerKey;
  lat: number;
  lon: number;
  bounds: { west: number; south: number; east: number; north: number };
  value: number;
  /** [bendera|null, nilai, jumlah ID kapal pada baris bendera tsb] */
  byFlag: Array<[string | null, number, number | null]>;
  rank: number;
  cellCount: number;
  start: string;
  end: string;
  provenance: ReportResult["provenance"];
};

export function getCellDetail(resultId: string, lat: number, lon: number): CellDetail | null {
  const entry = load(resultId);
  if (!entry) return null;
  const i = entry.index.get(key(lat, lon));
  if (i === undefined) return null;
  const cell = entry.result.payload.cells[i];
  return {
    resultId,
    layer: entry.compact.layer,
    lat: cell.lat,
    lon: cell.lon,
    bounds: {
      west: cell.lon - CELL_HALF_DEG,
      south: cell.lat - CELL_HALF_DEG,
      east: cell.lon + CELL_HALF_DEG,
      north: cell.lat + CELL_HALF_DEG,
    },
    value: cell.value,
    byFlag: cell.byFlag,
    // Sel disimpan terurut menurun menurut nilai (aggregateCells).
    rank: i + 1,
    cellCount: entry.compact.cellCount,
    start: entry.result.start,
    end: entry.result.end,
    provenance: entry.result.provenance,
  };
}
