import "server-only";
import { getRegion } from "@/lib/regions";
import type { CellsResult, DailyResult, VesselsResult } from "./aggregate";
import { changePercent, type Change } from "./metrics";
import { previousPeriod, type PeriodFilter } from "./period";
import type { ReportJobParams } from "./report-jobs";

/**
 * Menyusun bagian-bagian halaman Ringkasan (FR-04) dari hasil report tersimpan.
 * Render halaman TIDAK mengantre job (GET bebas efek samping); bagian yang belum siap dikirim ke
 * komponen klien yang mengantre lewat POST /api/analysis/jobs lalu me-refresh halaman.
 */

export { loadPart, type Part, type PartStatus } from "./parts";
import { loadPart, type Part } from "./parts";

export const KPI_DATASETS = ["fishingEffort", "presence", "sar"] as const;
export type KpiDataset = (typeof KPI_DATASETS)[number];

export type Overview = {
  filter: PeriodFilter;
  previous: PeriodFilter;
  current: Record<KpiDataset, Part<DailyResult>>;
  prior: Record<KpiDataset, Part<DailyResult>>;
  /** Jumlah ID kapal unik dari report keberadaan per vessel ID (periode aktif). */
  vessels: Part<VesselsResult>;
  /** Sel grid apparent fishing untuk ranking hotspot. */
  fishingCells: Part<CellsResult>;
  /** Parameter bagian yang belum fresh dan belum gagal — diantre otomatis oleh komponen klien. */
  pendingParams: ReportJobParams[];
  /** Parameter bagian yang job terakhirnya gagal — hanya diantre ulang lewat tombol "Coba lagi". */
  failedParams: ReportJobParams[];
};

export function buildOverview(filter: PeriodFilter): Overview | null {
  const region = getRegion(filter.regionId);
  if (!region?.analyzable) return null;
  const previous = previousPeriod(filter);
  const base = { regionId: filter.regionId };
  const daily = (dataset: KpiDataset, period: PeriodFilter) =>
    loadPart<DailyResult>({ ...base, dataset, kind: "daily", start: period.start, end: period.end }, region.geometryHash);

  const current = Object.fromEntries(KPI_DATASETS.map((d) => [d, daily(d, filter)])) as Overview["current"];
  const prior = Object.fromEntries(KPI_DATASETS.map((d) => [d, daily(d, previous)])) as Overview["prior"];
  const vessels = loadPart<VesselsResult>(
    { ...base, dataset: "presence", kind: "vessels", start: filter.start, end: filter.end },
    region.geometryHash,
  );
  const fishingCells = loadPart<CellsResult>(
    { ...base, dataset: "fishingEffort", kind: "cells", start: filter.start, end: filter.end },
    region.geometryHash,
  );

  // Urutan antre: KPI periode aktif dulu, lalu pembanding, lalu bagian yang lebih berat.
  // Bagian yang job terakhirnya gagal TIDAK diantre otomatis (hindari retry tanpa batas, FR-12);
  // pengguna memakai tombol "Coba lagi" (failedParams).
  const ordered: Part[] = [...Object.values(current), ...Object.values(prior), fishingCells, vessels];
  const pendingParams = ordered.filter((p) => p.status !== "ready" && !p.error).map((p) => p.params);
  const failedParams = ordered.filter((p) => p.error).map((p) => p.params);
  return { filter, previous, current, prior, vessels, fishingCells, pendingParams, failedParams };
}

export function kpiChange(current: Part<DailyResult>, prior: Part<DailyResult>): Change | null {
  if (!current.result || !prior.result) return null;
  return changePercent(current.result.payload.total, prior.result.payload.total);
}
