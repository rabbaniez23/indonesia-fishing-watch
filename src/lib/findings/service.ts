import { recordAudit } from "@/lib/audit";
import { getDb, newId, nowIso, transaction } from "@/lib/db";
import {
  canTransition,
  createFindingSchema,
  noteSchema,
  PRIORITY_LABEL,
  STATUS_LABEL,
  transitionNeedsReason,
  updateFindingSchema,
  type FilterSnapshot,
  type FindingPriority,
  type FindingSource,
  type FindingStatus,
} from "./model";

/**
 * Layanan temuan (FR-09). Otorisasi peran dilakukan di Route Handler; layanan ini menjaga
 * aturan bisnis: transisi status, alasan wajib, version guard, catatan append-only, audit.
 */

export class FindingError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "CONFLICT" | "INVALID_TRANSITION" | "INVALID_INPUT",
    message: string,
  ) {
    super(message);
  }
}

export type FindingSummary = {
  id: string;
  title: string;
  priority: FindingPriority;
  status: FindingStatus;
  sourceType: FindingSource["type"];
  regionId: string | null;
  filter: FilterSnapshot;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type FindingNote = {
  id: string;
  kind: "catatan" | "status" | "prioritas" | "dibuat";
  body: string;
  fromValue: string | null;
  toValue: string | null;
  actor: { id: string; name: string };
  createdAt: string;
};

export type FindingDetail = FindingSummary & {
  reason: string;
  priorityReason: string;
  source: FindingSource;
  updatedBy: { id: string; name: string };
  notes: FindingNote[];
};

type Row = {
  id: string;
  title: string;
  reason: string;
  priority: FindingPriority;
  priority_reason: string;
  status: FindingStatus;
  source_type: FindingSource["type"];
  source_json: string;
  filter_json: string;
  region_id: string | null;
  created_by: string;
  creator_name: string;
  created_at: string;
  updated_at: string;
  updated_by: string;
  updater_name: string;
  version: number;
};

const SELECT = `SELECT f.*, c.name AS creator_name, u.name AS updater_name
  FROM findings f JOIN users c ON c.id = f.created_by JOIN users u ON u.id = f.updated_by`;

function toSummary(row: Row): FindingSummary {
  return {
    id: row.id,
    title: row.title,
    priority: row.priority,
    status: row.status,
    sourceType: row.source_type,
    regionId: row.region_id,
    filter: JSON.parse(row.filter_json),
    createdBy: { id: row.created_by, name: row.creator_name },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

function insertNote(findingId: string, actorId: string, kind: FindingNote["kind"], body: string, from: string | null = null, to: string | null = null) {
  getDb()
    .prepare(
      `INSERT INTO finding_notes (id, finding_id, kind, body, from_value, to_value, actor_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(newId(), findingId, kind, body, from, to, actorId, nowIso());
}

export function createFinding(input: unknown, actorId: string): FindingDetail {
  const data = createFindingSchema.parse(input);
  const id = newId();
  const now = nowIso();
  const db = getDb();
  transaction(db, () => {
    db.prepare(
      `INSERT INTO findings (id, title, reason, priority, priority_reason, status, source_type, source_json, filter_json,
         region_id, created_by, created_at, updated_at, updated_by, version)
       VALUES (?, ?, ?, ?, ?, 'baru', ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    ).run(
      id,
      data.title,
      data.reason,
      data.priority,
      data.priorityReason,
      data.source.type,
      JSON.stringify(data.source),
      JSON.stringify(data.filter),
      data.filter.regionId || null,
      actorId,
      now,
      now,
      actorId,
    );
    insertNote(id, actorId, "dibuat", `Temuan dibuat dengan prioritas ${PRIORITY_LABEL[data.priority]}.`, null, "baru");
    recordAudit({ actorId, action: "finding.create", entityType: "finding", entityId: id, changes: { priority: data.priority, sourceType: data.source.type } });
  });
  return getFinding(id)!;
}

export function listFindings(filter: { status?: FindingStatus; limit?: number } = {}): FindingSummary[] {
  const limit = Math.min(200, Math.max(1, filter.limit ?? 100));
  const rows = (
    filter.status
      ? getDb().prepare(`${SELECT} WHERE f.status = ? ORDER BY f.updated_at DESC LIMIT ?`).all(filter.status, limit)
      : getDb().prepare(`${SELECT} ORDER BY f.updated_at DESC LIMIT ?`).all(limit)
  ) as Row[];
  return rows.map(toSummary);
}

export function countFindingsByStatus(): Record<FindingStatus, number> {
  const rows = getDb().prepare("SELECT status, COUNT(*) AS n FROM findings GROUP BY status").all() as Array<{ status: FindingStatus; n: number }>;
  const out: Record<FindingStatus, number> = { baru: 0, ditinjau: 0, perlu_informasi: 0, selesai: 0 };
  for (const r of rows) out[r.status] = r.n;
  return out;
}

export function getFinding(id: string): FindingDetail | null {
  const row = getDb().prepare(`${SELECT} WHERE f.id = ?`).get(id) as Row | undefined;
  if (!row) return null;
  const notes = (
    getDb()
      .prepare(
        `SELECT n.*, u.name AS actor_name FROM finding_notes n JOIN users u ON u.id = n.actor_id
         WHERE n.finding_id = ? ORDER BY n.created_at ASC, n.rowid ASC`,
      )
      .all(id) as Array<{ id: string; kind: FindingNote["kind"]; body: string; from_value: string | null; to_value: string | null; actor_id: string; actor_name: string; created_at: string }>
  ).map((n) => ({
    id: n.id,
    kind: n.kind,
    body: n.body,
    fromValue: n.from_value,
    toValue: n.to_value,
    actor: { id: n.actor_id, name: n.actor_name },
    createdAt: n.created_at,
  }));
  return {
    ...toSummary(row),
    reason: row.reason,
    priorityReason: row.priority_reason,
    source: JSON.parse(row.source_json),
    updatedBy: { id: row.updated_by, name: row.updater_name },
    notes,
  };
}

/** Ubah status/prioritas dengan version guard; perubahan dicatat sebagai catatan riwayat + audit. */
export function updateFinding(id: string, input: unknown, actorId: string): FindingDetail {
  const data = updateFindingSchema.parse(input);
  const db = getDb();
  transaction(db, () => {
    const current = db.prepare("SELECT status, priority, version FROM findings WHERE id = ?").get(id) as
      | { status: FindingStatus; priority: FindingPriority; version: number }
      | undefined;
    if (!current) throw new FindingError("NOT_FOUND", "Temuan tidak ditemukan.");
    if (current.version !== data.version) {
      throw new FindingError("CONFLICT", "Temuan sudah diubah pengguna lain. Muat ulang untuk melihat versi terbaru.");
    }
    const changes: Record<string, unknown> = {};
    let status = current.status;
    let priority = current.priority;

    if (data.status && data.status !== current.status) {
      if (!canTransition(current.status, data.status)) {
        throw new FindingError("INVALID_TRANSITION", `Status tidak dapat diubah dari ${STATUS_LABEL[current.status]} ke ${STATUS_LABEL[data.status]}.`);
      }
      if (transitionNeedsReason(current.status, data.status) && (data.statusReason ?? "").length < 5) {
        throw new FindingError("INVALID_INPUT", "Alasan wajib diisi (min. 5 karakter) untuk membuka kembali temuan.");
      }
      status = data.status;
      changes.status = { from: current.status, to: status };
      insertNote(
        id,
        actorId,
        "status",
        data.statusReason || `Status diubah menjadi ${STATUS_LABEL[status]}.`,
        current.status,
        status,
      );
    }
    if (data.priority && data.priority !== current.priority) {
      if ((data.priorityReason ?? "").length < 5) {
        throw new FindingError("INVALID_INPUT", "Alasan perubahan prioritas wajib diisi (min. 5 karakter).");
      }
      priority = data.priority;
      changes.priority = { from: current.priority, to: priority };
      insertNote(id, actorId, "prioritas", data.priorityReason!, current.priority, priority);
    }
    if (Object.keys(changes).length === 0) throw new FindingError("INVALID_INPUT", "Tidak ada perubahan.");

    const result = db
      .prepare(
        `UPDATE findings SET status = ?, priority = ?, priority_reason = CASE WHEN ? IS NULL THEN priority_reason ELSE ? END,
           updated_at = ?, updated_by = ?, version = version + 1
         WHERE id = ? AND version = ?`,
      )
      .run(status, priority, changes.priority ? data.priorityReason! : null, changes.priority ? data.priorityReason! : null, nowIso(), actorId, id, data.version);
    if (Number(result.changes) !== 1) throw new FindingError("CONFLICT", "Temuan sudah diubah pengguna lain.");
    recordAudit({ actorId, action: "finding.update", entityType: "finding", entityId: id, changes });
  });
  return getFinding(id)!;
}

export function addNote(id: string, input: unknown, actorId: string): FindingDetail {
  const { body } = noteSchema.parse(input);
  const db = getDb();
  transaction(db, () => {
    const exists = db.prepare("SELECT 1 FROM findings WHERE id = ?").get(id);
    if (!exists) throw new FindingError("NOT_FOUND", "Temuan tidak ditemukan.");
    insertNote(id, actorId, "catatan", body);
    db.prepare("UPDATE findings SET updated_at = ?, updated_by = ? WHERE id = ?").run(nowIso(), actorId, id);
    recordAudit({ actorId, action: "finding.note", entityType: "finding", entityId: id });
  });
  return getFinding(id)!;
}
