import { getDb, newId, nowIso, transaction } from "@/lib/db";

/**
 * Antrean job persisten berbasis tabel `jobs` dengan lease (PRD §11.1).
 * - Klaim atomik (BEGIN IMMEDIATE) → aman untuk beberapa worker.
 * - Lease kedaluwarsa (worker mati) → job bisa diklaim ulang; state upstream disimpan di job untuk pemulihan.
 * - Dedup: job aktif dengan dedup_key sama dipakai ulang, tidak dibuat ganda.
 */

export type JobState = "queued" | "running" | "succeeded" | "failed";

export type Job = {
  id: string;
  type: string;
  state: JobState;
  dedupKey: string;
  params: unknown;
  attempts: number;
  maxAttempts: number;
  runAfter: string;
  leaseOwner: string | null;
  leaseUntil: string | null;
  upstreamStartedAt: string | null;
  upstreamRequestHash: string | null;
  resultRef: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
};

type JobRow = {
  id: string;
  type: string;
  state: JobState;
  dedup_key: string;
  params_json: string;
  attempts: number;
  max_attempts: number;
  run_after: string;
  lease_owner: string | null;
  lease_until: string | null;
  upstream_started_at: string | null;
  upstream_request_hash: string | null;
  result_ref: string | null;
  error_code: string | null;
  error_message: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
};

function toJob(row: JobRow): Job {
  return {
    id: row.id,
    type: row.type,
    state: row.state,
    dedupKey: row.dedup_key,
    params: JSON.parse(row.params_json),
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    runAfter: row.run_after,
    leaseOwner: row.lease_owner,
    leaseUntil: row.lease_until,
    upstreamStartedAt: row.upstream_started_at,
    upstreamRequestHash: row.upstream_request_hash,
    resultRef: row.result_ref,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    finishedAt: row.finished_at,
  };
}

export function getJob(id: string): Job | null {
  const row = getDb().prepare("SELECT * FROM jobs WHERE id = ?").get(id) as JobRow | undefined;
  return row ? toJob(row) : null;
}

export function findActiveJob(dedupKey: string): Job | null {
  const row = getDb()
    .prepare("SELECT * FROM jobs WHERE dedup_key = ? AND state IN ('queued', 'running') ORDER BY created_at LIMIT 1")
    .get(dedupKey) as JobRow | undefined;
  return row ? toJob(row) : null;
}

/** Buat job baru, atau kembalikan job aktif dengan dedup_key sama (created=false). */
export function enqueueJob(input: {
  type: string;
  dedupKey: string;
  params: unknown;
  ownerId?: string | null;
  maxAttempts?: number;
}): { job: Job; created: boolean } {
  const db = getDb();
  return transaction(db, () => {
    const existing = findActiveJob(input.dedupKey);
    if (existing) return { job: existing, created: false };
    const now = nowIso();
    const id = newId();
    db.prepare(
      `INSERT INTO jobs (id, type, state, dedup_key, params_json, max_attempts, run_after, owner_id, created_at, updated_at)
       VALUES (?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, input.type, input.dedupKey, JSON.stringify(input.params), input.maxAttempts ?? 4, now, input.ownerId ?? null, now, now);
    return { job: getJob(id)!, created: true };
  });
}

/** Klaim satu job siap jalan (queued & run_after tercapai, atau running dengan lease kedaluwarsa). */
export function claimNextJob(workerId: string, leaseMs: number, types: string[], now: Date = new Date()): Job | null {
  const db = getDb();
  return transaction(db, () => {
    const nowText = nowIso(now);
    const placeholders = types.map(() => "?").join(", ");
    const row = db
      .prepare(
        `SELECT * FROM jobs
         WHERE type IN (${placeholders})
           AND ((state = 'queued' AND run_after <= ?) OR (state = 'running' AND lease_until < ?))
         ORDER BY created_at
         LIMIT 1`,
      )
      .get(...types, nowText, nowText) as JobRow | undefined;
    if (!row) return null;
    db.prepare(
      `UPDATE jobs SET state = 'running', lease_owner = ?, lease_until = ?, attempts = attempts + 1, updated_at = ?
       WHERE id = ?`,
    ).run(workerId, nowIso(new Date(now.getTime() + leaseMs)), nowText, row.id);
    return getJob(row.id);
  });
}

/** Perpanjang lease; false bila job sudah diambil worker lain (lease hilang). */
export function renewLease(jobId: string, workerId: string, leaseMs: number): boolean {
  const result = getDb()
    .prepare("UPDATE jobs SET lease_until = ?, updated_at = ? WHERE id = ? AND lease_owner = ? AND state = 'running'")
    .run(nowIso(new Date(Date.now() + leaseMs)), nowIso(), jobId, workerId);
  return Number(result.changes) === 1;
}

export function markUpstreamStarted(jobId: string, requestHash: string): void {
  getDb()
    .prepare("UPDATE jobs SET upstream_started_at = ?, upstream_request_hash = ?, updated_at = ? WHERE id = ?")
    .run(nowIso(), requestHash, nowIso(), jobId);
}

export function completeJob(jobId: string, workerId: string, resultRef: string): void {
  const now = nowIso();
  getDb()
    .prepare(
      `UPDATE jobs SET state = 'succeeded', result_ref = ?, lease_owner = NULL, lease_until = NULL, error_code = NULL,
         error_message = NULL, finished_at = ?, updated_at = ?
       WHERE id = ? AND lease_owner = ?`,
    )
    .run(resultRef, now, now, jobId, workerId);
}

/**
 * Gagal sementara → antre lagi dengan backoff (bila masih ada sisa attempt); gagal permanen → failed.
 * `countAttempt=false` dipakai bila job hanya ditunda (mis. lock report dipegang job lain).
 */
export function retryOrFailJob(
  jobId: string,
  workerId: string,
  error: { code: string; message: string; retryable: boolean; delayMs?: number },
  countAttempt = true,
): JobState {
  const job = getJob(jobId);
  if (!job || job.leaseOwner !== workerId) return job?.state ?? "failed";
  const now = new Date();
  const attempts = countAttempt ? job.attempts : job.attempts - 1;
  const canRetry = error.retryable && attempts < job.maxAttempts;
  const state: JobState = canRetry ? "queued" : "failed";
  const delay = error.delayMs ?? Math.min(15 * 60_000, 15_000 * 2 ** Math.max(0, attempts - 1));
  getDb()
    .prepare(
      `UPDATE jobs SET state = ?, attempts = ?, run_after = ?, lease_owner = NULL, lease_until = NULL,
         error_code = ?, error_message = ?, finished_at = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      state,
      attempts,
      nowIso(new Date(now.getTime() + (canRetry ? delay : 0))),
      error.code,
      error.message.slice(0, 500),
      state === "failed" ? nowIso(now) : null,
      nowIso(now),
      jobId,
    );
  return state;
}

/** Job terbaru untuk dedup_key (apa pun statusnya) — dipakai untuk menampilkan error terakhir. */
export function findLatestJob(dedupKey: string): Job | null {
  const row = getDb().prepare("SELECT * FROM jobs WHERE dedup_key = ? ORDER BY created_at DESC LIMIT 1").get(dedupKey) as
    | JobRow
    | undefined;
  return row ? toJob(row) : null;
}
