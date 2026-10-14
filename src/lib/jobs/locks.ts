import { getDb, nowIso, transaction } from "@/lib/db";

/**
 * Lock berbasis database dengan lease, berlaku lintas proses web/worker (PRD §11.3:
 * report generation diserialkan per identitas akun GFW). Lease kedaluwarsa → lock dapat diambil alih.
 */

export type LockInfo = { name: string; owner: string; leaseUntil: string; meta: Record<string, unknown> | null; acquiredAt: string };

export function getLock(name: string): LockInfo | null {
  const row = getDb().prepare("SELECT * FROM locks WHERE name = ?").get(name) as
    | { name: string; owner: string; lease_until: string; meta_json: string | null; acquired_at: string }
    | undefined;
  if (!row) return null;
  return {
    name: row.name,
    owner: row.owner,
    leaseUntil: row.lease_until,
    meta: row.meta_json ? JSON.parse(row.meta_json) : null,
    acquiredAt: row.acquired_at,
  };
}

/**
 * Ambil lock bila kosong, kedaluwarsa, atau sudah milik `owner`. Meta lama dipertahankan saat mengambil alih
 * lock kedaluwarsa (berisi jejak report terakhir untuk pemulihan last-report).
 */
export function acquireLock(name: string, owner: string, leaseMs: number, now: Date = new Date()): boolean {
  const db = getDb();
  return transaction(db, () => {
    const current = getLock(name);
    const leaseUntil = nowIso(new Date(now.getTime() + leaseMs));
    if (!current) {
      db.prepare("INSERT INTO locks (name, owner, lease_until, meta_json, acquired_at) VALUES (?, ?, ?, NULL, ?)").run(
        name,
        owner,
        leaseUntil,
        nowIso(now),
      );
      return true;
    }
    if (current.owner !== owner && Date.parse(current.leaseUntil) > now.getTime()) return false;
    db.prepare("UPDATE locks SET owner = ?, lease_until = ?, acquired_at = ? WHERE name = ?").run(owner, leaseUntil, nowIso(now), name);
    return true;
  });
}

export function renewLock(name: string, owner: string, leaseMs: number): boolean {
  const result = getDb()
    .prepare("UPDATE locks SET lease_until = ? WHERE name = ? AND owner = ?")
    .run(nowIso(new Date(Date.now() + leaseMs)), name, owner);
  return Number(result.changes) === 1;
}

export function setLockMeta(name: string, owner: string, meta: Record<string, unknown>): void {
  getDb().prepare("UPDATE locks SET meta_json = ? WHERE name = ? AND owner = ?").run(JSON.stringify(meta), name, owner);
}

/** Lepas lock: lease dibuat kedaluwarsa, meta tetap tersimpan sebagai jejak report terakhir. */
export function releaseLock(name: string, owner: string): void {
  getDb().prepare("UPDATE locks SET lease_until = ? WHERE name = ? AND owner = ?").run(nowIso(new Date(0)), name, owner);
}
