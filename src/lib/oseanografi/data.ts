import "server-only";
import linkJson from "@/data/oseanografi/link.json";
import metaJson from "@/data/oseanografi/meta.json";
import seasonalJson from "@/data/oseanografi/seasonal.json";
import seriesJson from "@/data/oseanografi/series.json";
import trendsJson from "@/data/oseanografi/trends.json";
import type { OceanLink, OceanMeta, OceanSeasonal, OceanSeries, OceanTrends, OceanVarKey } from "./types";

/**
 * Ringkasan oseanografi statis (dibangun offline dari Copernicus Marine). Grid peta per variabel tidak diimpor di
 * sini — dilayani lewat /api/oseanografi/grid/[variabel] agar halaman tetap ringan.
 */
export const oceanMeta = metaJson as unknown as OceanMeta;
export const oceanSeries = seriesJson as unknown as OceanSeries;
export const oceanSeasonal = seasonalJson as unknown as OceanSeasonal;
export const oceanTrends = trendsJson as unknown as OceanTrends;
export const oceanLink = linkJson as unknown as OceanLink;

export function oceanVar(key: OceanVarKey) {
  return oceanMeta.variables.find((v) => v.key === key) ?? null;
}
