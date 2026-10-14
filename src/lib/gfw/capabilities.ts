import { getDb, nowIso } from "@/lib/db";

/**
 * Allowlist dataset GFW yang dipakai aplikasi (PRD §6.1, §11.3).
 * Sumber: GFW Key Concepts — daftar dataset & versi (dibaca 13 Okt 2026).
 * `docSupported` = disebut dokumentasi; status akses baru "ok" setelah contract check sukses.
 * Browser tidak pernah mengirim nama dataset bebas; hanya alias di daftar ini yang boleh dipakai.
 */
export type DatasetFamily = "4wings" | "events" | "vessels" | "regions";

export type DatasetDefinition = {
  alias: string;
  family: DatasetFamily;
  label: string;
  /** Prioritas PRD; P1 tetap terdaftar tetapi tidak diaktifkan di MVP. */
  priority: "P0" | "P1";
  notes?: string;
};

export const DATASETS = {
  fishingEffort: {
    alias: "public-global-fishing-effort:latest",
    family: "4wings",
    label: "Apparent fishing (AIS)",
    priority: "P0",
    notes: "Jam aktivitas perkiraan terkait penangkapan; data sampai sekitar 96 jam lalu menurut dokumentasi.",
  },
  presence: {
    alias: "public-global-presence:latest",
    family: "4wings",
    label: "Keberadaan kapal berbasis AIS",
    priority: "P0",
    notes: "Jam keberadaan berbasis grid; bukan lintasan kapal.",
  },
  sar: {
    alias: "public-global-sar-presence:latest",
    family: "4wings",
    label: "Deteksi radar (Sentinel-1 SAR)",
    priority: "P0",
    notes: "Deteksi teramati; sampai sekitar 5 hari lalu menurut dokumentasi. Kapal dapat terdeteksi lebih dari sekali.",
  },
  fishingEvents: {
    alias: "public-global-fishing-events:latest",
    family: "events",
    label: "Kejadian fishing",
    priority: "P0",
  },
  encounterEvents: {
    alias: "public-global-encounters-events:latest",
    family: "events",
    label: "Kejadian encounter",
    priority: "P0",
    notes: "Encounter bukan bukti transshipment.",
  },
  loiteringEvents: {
    alias: "public-global-loitering-events:latest",
    family: "events",
    label: "Kejadian loitering",
    priority: "P0",
  },
  portVisitEvents: {
    alias: "public-global-port-visits-events:latest",
    family: "events",
    label: "Kunjungan pelabuhan",
    priority: "P0",
    notes: "Dokumentasi menyebut alias latest → v3.1, tetapi respons nyata (13 Okt 2026) menyatakan v4.0; versi dilayani dicatat dari respons.",
  },
  gapEvents: {
    alias: "public-global-gaps-events:latest",
    family: "events",
    label: "AIS gap (prototype)",
    priority: "P1",
    notes: "P1 — nonaktif pada MVP pertama.",
  },
  vesselIdentity: {
    alias: "public-global-vessel-identity:latest",
    family: "vessels",
    label: "Identitas kapal (AIS & registry)",
    priority: "P0",
  },
  eezRegions: {
    alias: "public-eez-areas",
    family: "regions",
    label: "Daftar ZEE (context layer)",
    priority: "P0",
  },
} as const satisfies Record<string, DatasetDefinition>;

export type DatasetKey = keyof typeof DATASETS;

const ALL: DatasetDefinition[] = Object.values(DATASETS);

export function isAllowedDataset(alias: string): boolean {
  return ALL.some((d) => d.alias === alias);
}

/** Pastikan setiap dataset allowlist ada di tabel registry (status awal: untested). */
export function ensureDatasetRegistry(): void {
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO datasets (alias, family, label, doc_supported, access_status, notes)
     VALUES (?, ?, ?, 1, 'untested', ?)
     ON CONFLICT(alias) DO UPDATE SET family = excluded.family, label = excluded.label, notes = excluded.notes`,
  );
  for (const d of ALL) insert.run(d.alias, d.family, d.label, d.notes ?? null);
}

export function recordDatasetSuccess(alias: string, resolvedVersion: string | null): void {
  const now = nowIso();
  getDb()
    .prepare(
      `UPDATE datasets SET access_status = 'ok', resolved_version = COALESCE(?, resolved_version),
         last_checked_at = ?, last_success_at = ?, last_error_code = NULL, last_error_detail = NULL
       WHERE alias = ?`,
    )
    .run(resolvedVersion, now, now, alias);
}

export function recordDatasetFailure(alias: string, code: string, detail: string | null, unsupported = false): void {
  getDb()
    .prepare(
      `UPDATE datasets SET access_status = ?, last_checked_at = ?, last_error_code = ?, last_error_detail = ?
       WHERE alias = ?`,
    )
    .run(unsupported ? "unsupported" : "error", nowIso(), code, detail?.slice(0, 500) ?? null, alias);
}

/**
 * Header `x-datasets` memberi versi yang benar-benar dilayani (dokumentasi Key Concepts).
 * Formatnya belum diverifikasi; nilai mentah dicari yang memuat nama dataset.
 */
export function resolvedVersionFromHeader(header: string | undefined, alias: string): string | null {
  if (!header) return null;
  const base = alias.split(":")[0];
  const match = header
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${base}:`));
  return match ?? null;
}
