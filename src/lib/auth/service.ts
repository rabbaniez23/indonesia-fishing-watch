import { getDb, newId, nowIso, transaction } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { hashPassword, verifyPassword } from "./password";
import { validateNewPassword } from "./password-policy";
import { isRole, type Role } from "./roles";
import { generateToken, hashToken } from "./tokens";

/**
 * Logika autentikasi tanpa ketergantungan pada Next.js (dapat diuji & dipakai skrip).
 * Lapisan cookie ada di ./session.ts.
 */

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Perlindungan tebak-sandi: 10 kegagalan beruntun dalam 5 menit mengunci email itu sampai kegagalan lama lewat 5 menit. */
export const LOCKOUT_WINDOW_MS = 5 * 60 * 1000;
export const LOCKOUT_MAX_FAILURES = 10;
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

export type SafeUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

type UserRow = SafeUser & { password_hash: string; status: "active" | "disabled" };

export class AuthError extends Error {
  constructor(
    public readonly code: "EMAIL_TAKEN" | "INVALID_INPUT" | "INVITE_INVALID",
    message: string,
  ) {
    super(message);
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function toSafeUser(row: UserRow): SafeUser {
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

function findUserRowByEmail(email: string): UserRow | undefined {
  return getDb().prepare("SELECT * FROM users WHERE email = ?").get(normalizeEmail(email)) as UserRow | undefined;
}

export function findUserById(id: string): SafeUser | null {
  const row = getDb().prepare("SELECT * FROM users WHERE id = ? AND status = 'active'").get(id) as
    | UserRow
    | undefined;
  return row ? toSafeUser(row) : null;
}

export function countUsers(): number {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
}

type NewUser = { email: string; name: string; role: Role; password: string };

function validateNewUser(input: NewUser): void {
  if (!isValidEmail(normalizeEmail(input.email))) throw new AuthError("INVALID_INPUT", "Format email tidak valid.");
  const name = input.name.trim();
  if (name.length < 1 || name.length > 120) throw new AuthError("INVALID_INPUT", "Nama wajib diisi (maks. 120 karakter).");
  if (!isRole(input.role)) throw new AuthError("INVALID_INPUT", "Peran tidak dikenal.");
  const passwordError = validateNewPassword(input.password);
  if (passwordError) throw new AuthError("INVALID_INPUT", passwordError);
}

function insertUser(user: SafeUser, passwordHash: string, actorId: string | null): void {
  if (findUserRowByEmail(user.email)) throw new AuthError("EMAIL_TAKEN", "Email sudah terdaftar.");
  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO users (id, email, name, role, password_hash, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
    )
    .run(user.id, user.email, user.name, user.role, passwordHash, now, now);
  recordAudit({ actorId, action: "user.create", entityType: "user", entityId: user.id, changes: { role: user.role } });
}

/** Buat pengguna aktif. Dipakai oleh seed admin. */
export async function createUser(input: NewUser, actorId: string | null = null): Promise<SafeUser> {
  validateNewUser(input);
  const user: SafeUser = { id: newId(), email: normalizeEmail(input.email), name: input.name.trim(), role: input.role };
  if (findUserRowByEmail(user.email)) throw new AuthError("EMAIL_TAKEN", "Email sudah terdaftar.");
  const passwordHash = await hashPassword(input.password);
  insertUser(user, passwordHash, actorId);
  return user;
}

// ---------------------------------------------------------------------------
// Login dengan pembatasan percobaan gagal
// ---------------------------------------------------------------------------

export type AuthenticateResult = { ok: true; user: SafeUser } | { ok: false; reason: "invalid" | "locked" };

// Hash tiruan agar waktu respons serupa saat email tidak terdaftar.
let dummyHash: Promise<string> | null = null;

export function isLockedOut(email: string, now: Date = new Date()): boolean {
  const since = new Date(now.getTime() - LOCKOUT_WINDOW_MS).toISOString();
  const rows = getDb()
    .prepare(
      `SELECT succeeded FROM login_attempts
       WHERE email = ? AND attempted_at >= ?
       ORDER BY attempted_at DESC, id DESC`,
    )
    .all(normalizeEmail(email), since) as Array<{ succeeded: number }>;
  let failures = 0;
  for (const row of rows) {
    if (row.succeeded) break; // hitung kegagalan beruntun sejak login sukses terakhir
    failures += 1;
  }
  return failures >= LOCKOUT_MAX_FAILURES;
}

function recordAttempt(email: string, succeeded: boolean): void {
  getDb()
    .prepare("INSERT INTO login_attempts (email, succeeded, attempted_at) VALUES (?, ?, ?)")
    .run(normalizeEmail(email), succeeded ? 1 : 0, nowIso());
}

export async function authenticate(email: string, password: string): Promise<AuthenticateResult> {
  const normalized = normalizeEmail(email);
  if (!normalized || !password || password.length > 256) return { ok: false, reason: "invalid" };
  if (isLockedOut(normalized)) return { ok: false, reason: "locked" };

  const row = findUserRowByEmail(normalized);
  if (!row || row.status !== "active") {
    dummyHash ??= hashPassword("dummy-password-for-timing");
    await verifyPassword(password, await dummyHash);
    recordAttempt(normalized, false);
    return { ok: false, reason: "invalid" };
  }

  const valid = await verifyPassword(password, row.password_hash);
  recordAttempt(normalized, valid);
  if (!valid) return { ok: false, reason: isLockedOut(normalized) ? "locked" : "invalid" };
  return { ok: true, user: toSafeUser(row) };
}

// ---------------------------------------------------------------------------
// Sesi (token acak di cookie; database menyimpan hash-nya saja)
// ---------------------------------------------------------------------------

export function createSession(userId: string, now: Date = new Date()): { token: string; expiresAt: Date } {
  const token = generateToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  getDb()
    .prepare(
      `INSERT INTO sessions (id, token_hash, user_id, created_at, expires_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(newId(), hashToken(token), userId, nowIso(now), nowIso(expiresAt), nowIso(now));
  return { token, expiresAt };
}

/** Kembalikan pengguna untuk token sesi yang masih berlaku dan pengguna yang aktif. */
export function validateSession(token: string | undefined | null, now: Date = new Date()): SafeUser | null {
  if (!token || token.length > 128) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT s.id AS session_id, s.expires_at, s.last_seen_at, u.*
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`,
    )
    .get(hashToken(token)) as (UserRow & { session_id: string; expires_at: string; last_seen_at: string }) | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= now.getTime() || row.status !== "active") {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(row.session_id);
    return null;
  }
  if (now.getTime() - new Date(row.last_seen_at).getTime() > LAST_SEEN_THROTTLE_MS) {
    db.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").run(nowIso(now), row.session_id);
  }
  return toSafeUser(row);
}

export function revokeSession(token: string): void {
  getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}

export function revokeUserSessions(userId: string): void {
  getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

// ---------------------------------------------------------------------------
// Undangan (tidak ada signup publik pada MVP)
// ---------------------------------------------------------------------------

type InviteRow = {
  id: string;
  email: string;
  role: Role;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

export type PendingInvite = { id: string; email: string; role: Role; expiresAt: string };

export function createInvite(
  input: { email: string; role: Role; invitedBy: string },
  now: Date = new Date(),
): { token: string; invite: PendingInvite } {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) throw new AuthError("INVALID_INPUT", "Format email tidak valid.");
  if (!isRole(input.role)) throw new AuthError("INVALID_INPUT", "Peran tidak dikenal.");
  if (findUserRowByEmail(email)) throw new AuthError("EMAIL_TAKEN", "Email sudah terdaftar sebagai pengguna.");

  const db = getDb();
  const token = generateToken();
  const invite: PendingInvite = {
    id: newId(),
    email,
    role: input.role,
    expiresAt: nowIso(new Date(now.getTime() + INVITE_TTL_MS)),
  };
  transaction(db, () => {
    // Undangan lama yang belum dipakai untuk email yang sama dicabut.
    db.prepare(
      "UPDATE invites SET revoked_at = ? WHERE email = ? AND accepted_at IS NULL AND revoked_at IS NULL",
    ).run(nowIso(now), email);
    db.prepare(
      `INSERT INTO invites (id, email, role, token_hash, invited_by, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(invite.id, email, invite.role, hashToken(token), input.invitedBy, nowIso(now), invite.expiresAt);
  });
  recordAudit({
    actorId: input.invitedBy,
    action: "invite.create",
    entityType: "invite",
    entityId: invite.id,
    changes: { email, role: invite.role },
  });
  return { token, invite };
}

export function findPendingInvite(token: string | undefined | null, now: Date = new Date()): PendingInvite | null {
  if (!token || token.length > 128) return null;
  const row = getDb().prepare("SELECT * FROM invites WHERE token_hash = ?").get(hashToken(token)) as
    | InviteRow
    | undefined;
  if (!row || row.accepted_at || row.revoked_at) return null;
  if (new Date(row.expires_at).getTime() <= now.getTime()) return null;
  return { id: row.id, email: row.email, role: row.role, expiresAt: row.expires_at };
}

export async function acceptInvite(token: string, input: { name: string; password: string }): Promise<SafeUser> {
  const invite = findPendingInvite(token);
  if (!invite) throw new AuthError("INVITE_INVALID", "Undangan tidak berlaku atau sudah dipakai.");
  validateNewUser({ email: invite.email, name: input.name, role: invite.role, password: input.password });
  const passwordHash = await hashPassword(input.password);
  const user: SafeUser = { id: newId(), email: invite.email, name: input.name.trim(), role: invite.role };

  const db = getDb();
  transaction(db, () => {
    // Periksa ulang di dalam transaksi: undangan bisa dipakai/dicabut selama hashing.
    if (!findPendingInvite(token)) throw new AuthError("INVITE_INVALID", "Undangan tidak berlaku atau sudah dipakai.");
    insertUser(user, passwordHash, null);
    db.prepare("UPDATE invites SET accepted_at = ?, accepted_user_id = ? WHERE id = ?").run(nowIso(), user.id, invite.id);
    recordAudit({ actorId: user.id, action: "invite.accept", entityType: "invite", entityId: invite.id });
  });
  return user;
}

// ---------------------------------------------------------------------------
// Daftar untuk halaman Pengaturan (Admin)
// ---------------------------------------------------------------------------

export type UserListItem = SafeUser & { status: "active" | "disabled"; createdAt: string };

export function listUsers(): UserListItem[] {
  const rows = getDb()
    .prepare("SELECT id, email, name, role, status, created_at FROM users ORDER BY created_at ASC")
    .all() as Array<SafeUser & { status: "active" | "disabled"; created_at: string }>;
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export function listPendingInvites(now: Date = new Date()): PendingInvite[] {
  const rows = getDb()
    .prepare(
      `SELECT id, email, role, expires_at FROM invites
       WHERE accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ?
       ORDER BY created_at DESC`,
    )
    .all(nowIso(now)) as Array<{ id: string; email: string; role: Role; expires_at: string }>;
  return rows.map((row) => ({ id: row.id, email: row.email, role: row.role, expiresAt: row.expires_at }));
}

// ---------------------------------------------------------------------------
// Pengelolaan pengguna oleh Admin
// ---------------------------------------------------------------------------

function activeAdminCount(): number {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND status = 'active'").get() as { n: number }).n;
}

/**
 * Ubah peran/status pengguna. Penjaga: Admin tidak dapat mengubah dirinya sendiri, dan Admin aktif terakhir
 * tidak dapat diturunkan/dinonaktifkan. Menonaktifkan mencabut semua sesi (berlaku segera).
 */
export function updateUserAccess(actorId: string, userId: string, change: { role?: Role; status?: "active" | "disabled" }): UserListItem {
  if (actorId === userId) throw new AuthError("INVALID_INPUT", "Anda tidak dapat mengubah peran atau status akun sendiri.");
  if (change.role !== undefined && !isRole(change.role)) throw new AuthError("INVALID_INPUT", "Peran tidak dikenal.");
  const db = getDb();
  return transaction(db, () => {
    const row = db.prepare("SELECT id, role, status FROM users WHERE id = ?").get(userId) as { id: string; role: Role; status: "active" | "disabled" } | undefined;
    if (!row) throw new AuthError("INVALID_INPUT", "Pengguna tidak ditemukan.");
    const nextRole = change.role ?? row.role;
    const nextStatus = change.status ?? row.status;
    const losesAdmin = row.role === "admin" && row.status === "active" && (nextRole !== "admin" || nextStatus !== "active");
    if (losesAdmin && activeAdminCount() <= 1) throw new AuthError("INVALID_INPUT", "Harus tetap ada minimal satu Admin aktif.");
    db.prepare("UPDATE users SET role = ?, status = ?, updated_at = ? WHERE id = ?").run(nextRole, nextStatus, nowIso(), userId);
    if (nextStatus === "disabled") revokeUserSessions(userId);
    recordAudit({
      actorId,
      action: "user.update",
      entityType: "user",
      entityId: userId,
      changes: { role: { from: row.role, to: nextRole }, status: { from: row.status, to: nextStatus } },
    });
    return listUsers().find((u) => u.id === userId)!;
  });
}
