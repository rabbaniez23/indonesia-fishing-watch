import { getDb, newId, nowIso } from "@/lib/db";

type AuditInput = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  /** Jangan memasukkan token, password, atau secret. */
  changes?: Record<string, unknown>;
};

export function recordAudit({ actorId, action, entityType, entityId = null, changes }: AuditInput): void {
  getDb()
    .prepare(
      `INSERT INTO audit_entries (id, actor_id, action, entity_type, entity_id, changes_json, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(newId(), actorId, action, entityType, entityId, changes ? JSON.stringify(changes) : null, nowIso());
}
