import { getDb } from "@/lib/db";
import { DATASETS, ensureDatasetRegistry, type DatasetFamily } from "@/lib/gfw/capabilities";
import { budgetToday } from "@/lib/gfw/http";
import { listRegions, type RegionSummary } from "@/lib/regions";

/** Status sumber untuk halaman & API /data-status (FR-11). Tidak pernah memuat token atau URL privat. */

export type DatasetStatus = {
  alias: string;
  family: DatasetFamily;
  label: string;
  priority: "P0" | "P1";
  docSupported: boolean;
  accessStatus: "untested" | "ok" | "error" | "unsupported";
  resolvedVersion: string | null;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastErrorCode: string | null;
  /** Hanya diisi untuk Admin. */
  lastErrorDetail?: string | null;
  notes: string | null;
};

export type DataStatus = {
  tokenConfigured: boolean;
  /** "Tersambung" hanya bila minimal satu request terautentikasi pernah sukses. */
  connected: boolean;
  datasets: DatasetStatus[];
  regions: RegionSummary[];
  budget: ReturnType<typeof budgetToday>;
};

type Row = {
  alias: string;
  family: DatasetFamily;
  label: string;
  doc_supported: number;
  access_status: DatasetStatus["accessStatus"];
  resolved_version: string | null;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_error_code: string | null;
  last_error_detail: string | null;
  notes: string | null;
};

const ORDER: string[] = Object.values(DATASETS).map((d) => d.alias);

export function getDataStatus({ includeErrorDetail }: { includeErrorDetail: boolean }): DataStatus {
  ensureDatasetRegistry();
  const rows = getDb().prepare("SELECT * FROM datasets").all() as Row[];
  const priorities = new Map<string, "P0" | "P1">(Object.values(DATASETS).map((d) => [d.alias, d.priority]));
  const datasets = rows
    .filter((row) => priorities.has(row.alias))
    .sort((a, b) => ORDER.indexOf(a.alias) - ORDER.indexOf(b.alias))
    .map<DatasetStatus>((row) => ({
      alias: row.alias,
      family: row.family,
      label: row.label,
      priority: priorities.get(row.alias)!,
      docSupported: row.doc_supported === 1,
      accessStatus: row.access_status,
      resolvedVersion: row.resolved_version,
      lastCheckedAt: row.last_checked_at,
      lastSuccessAt: row.last_success_at,
      lastErrorCode: row.last_error_code,
      ...(includeErrorDetail ? { lastErrorDetail: row.last_error_detail } : {}),
      notes: row.notes,
    }));
  return {
    tokenConfigured: Boolean(process.env.GFW_API_ACCESS_TOKEN),
    connected: datasets.some((d) => d.lastSuccessAt !== null),
    datasets,
    regions: listRegions(),
    budget: budgetToday(),
  };
}
