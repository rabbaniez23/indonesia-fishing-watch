import path from "node:path";
import { recordAudit } from "@/lib/audit";
import { getDb, newId, nowIso, transaction } from "@/lib/db";
import { MAX_DAYS, validateFilter } from "@/lib/analysis/period";
import { enqueueJob } from "@/lib/jobs/queue";
import { PORT_MAX_DAYS } from "@/lib/ports/port-jobs";
import { getRegion } from "@/lib/regions";
import { createReportRequestSchema, type CreateReportInput, type ReportStatus, type ReportType } from "./model";

export const EXPORT_JOB_TYPE = "report_export";

export class ReportError extends Error {
  constructor(
    public readonly code: "INVALID_INPUT" | "INVALID_RANGE" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
  }
}

export function reportsDir(): string {
  return process.env.REPORTS_DIR || path.join(process.cwd(), "storage", "reports");
}

export type ReportRecord = {
  id: string;
  type: ReportType;
  params: CreateReportInput;
  status: ReportStatus;
  jobId: string | null;
  fileName: string | null;
  fileSize: number | null;
  rowCount: number | null;
  completeness: string | null;
  snapshotRefs: string[];
  errorCode: string | null;
  errorMessage: string | null;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
  expiresAt: string | null;
  /** true bila masa simpan file sudah berakhir (dihitung saat dibaca). */
  expired: boolean;
};

type Row = {
  id: string;
  type: ReportType;
  params_json: string;
  status: ReportStatus;
  job_id: string | null;
  file_name: string | null;
  file_size: number | null;
  row_count: number | null;
  completeness: string | null;
  snapshot_refs: string | null;
  deferrals: number;
  error_code: string | null;
  error_message: string | null;
  created_by: string;
  creator_name: string;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
  expires_at: string | null;
};

const SELECT = "SELECT r.*, u.name AS creator_name FROM reports r JOIN users u ON u.id = r.created_by";

function toRecord(row: Row): ReportRecord {
  return {
    id: row.id,
    type: row.type,
    params: JSON.parse(row.params_json),
    status: row.status,
    jobId: row.job_id,
    fileName: row.file_name,
    fileSize: row.file_size,
    rowCount: row.row_count,
    completeness: row.completeness,
    snapshotRefs: row.snapshot_refs ? JSON.parse(row.snapshot_refs) : [],
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdBy: { id: row.created_by, name: row.creator_name },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    finishedAt: row.finished_at,
    expiresAt: row.expires_at,
    expired: row.expires_at !== null && Date.parse(row.expires_at) < Date.now(),
  };
}

export function getReport(id: string): ReportRecord | null {
  const row = getDb().prepare(`${SELECT} WHERE r.id = ?`).get(id) as Row | undefined;
  return row ? toRecord(row) : null;
}

export function getReportDeferrals(id: string): number {
  return (getDb().prepare("SELECT deferrals FROM reports WHERE id = ?").get(id) as { deferrals: number } | undefined)?.deferrals ?? 0;
}

export function listReports(limit = 50): ReportRecord[] {
  return (getDb().prepare(`${SELECT} ORDER BY r.created_at DESC LIMIT ?`).all(limit) as Row[]).map(toRecord);
}

/** Buat laporan + job ekspor. Idempotency key per pengguna mencegah duplikat saat tombol ditekan dua kali. */
export function createReport(input: unknown, userId: string): { report: ReportRecord; created: boolean } {
  const parsed = createReportRequestSchema.safeParse(input);
  if (!parsed.success) throw new ReportError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Parameter laporan tidak valid.");
  const { idempotencyKey, params } = parsed.data;
  const maxDays = params.type === "kunjungan_pelabuhan" ? PORT_MAX_DAYS : MAX_DAYS;
  const range = validateFilter({ regionId: params.regionId, from: params.from, to: params.to }, new Date(), maxDays);
  if (!range.ok) throw new ReportError("INVALID_RANGE", range.error);
  if (!getRegion(params.regionId)?.analyzable) throw new ReportError("INVALID_INPUT", "Wilayah tidak tervalidasi.");

  const db = getDb();
  return transaction(db, () => {
    const existing = db.prepare("SELECT id FROM reports WHERE created_by = ? AND idempotency_key = ?").get(userId, idempotencyKey) as
      | { id: string }
      | undefined;
    if (existing) return { report: getReport(existing.id)!, created: false };
    const id = newId();
    const now = nowIso();
    db.prepare(
      `INSERT INTO reports (id, type, params_json, status, idempotency_key, created_by, created_at, updated_at)
       VALUES (?, ?, ?, 'antre', ?, ?, ?, ?)`,
    ).run(id, params.type, JSON.stringify(params), idempotencyKey, userId, now, now);
    const { job } = enqueueJob({ type: EXPORT_JOB_TYPE, dedupKey: `report:${id}`, params: { reportId: id }, ownerId: userId, maxAttempts: 3 });
    db.prepare("UPDATE reports SET job_id = ? WHERE id = ?").run(job.id, id);
    recordAudit({ actorId: userId, action: "report.create", entityType: "report", entityId: id, changes: { type: params.type } });
    return { report: getReport(id)!, created: true };
  });
}

export function markReport(id: string, patch: Partial<{ status: ReportStatus; errorCode: string | null; errorMessage: string | null; deferrals: number }>) {
  const current = getDb().prepare("SELECT * FROM reports WHERE id = ?").get(id) as Row | undefined;
  if (!current) return;
  const done = patch.status === "siap" || patch.status === "gagal";
  getDb()
    .prepare(
      `UPDATE reports SET status = ?, error_code = ?, error_message = ?, deferrals = ?, updated_at = ?,
         finished_at = CASE WHEN ? THEN ? ELSE finished_at END WHERE id = ?`,
    )
    .run(
      patch.status ?? current.status,
      patch.errorCode === undefined ? current.error_code : patch.errorCode,
      patch.errorMessage === undefined ? current.error_message : patch.errorMessage,
      patch.deferrals ?? current.deferrals,
      nowIso(),
      done ? 1 : 0,
      nowIso(),
      id,
    );
}

export function completeReport(
  id: string,
  file: { name: string; size: number; rows: number; completeness: string; refs: string[]; expiresAt: string },
) {
  getDb()
    .prepare(
      `UPDATE reports SET status = 'siap', file_name = ?, file_size = ?, row_count = ?, completeness = ?, snapshot_refs = ?,
         error_code = NULL, error_message = NULL, updated_at = ?, finished_at = ?, expires_at = ? WHERE id = ?`,
    )
    .run(file.name, file.size, file.rows, file.completeness, JSON.stringify(file.refs), nowIso(), nowIso(), file.expiresAt, id);
}
