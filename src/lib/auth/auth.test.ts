import { beforeEach, describe, expect, it } from "vitest";
import { getDb, openDatabase, setDbForTesting } from "@/lib/db";
import { hashPassword, verifyPassword } from "./password";
import { can, hasRole } from "./roles";
import {
  acceptInvite,
  authenticate,
  AuthError,
  createInvite,
  createSession,
  createUser,
  findPendingInvite,
  isLockedOut,
  LOCKOUT_MAX_FAILURES,
  LOCKOUT_WINDOW_MS,
  revokeSession,
  SESSION_TTL_MS,
  validateSession,
} from "./service";
import { hashToken } from "./tokens";

const PASSWORD = "kata-sandi-panjang-1";

beforeEach(() => {
  setDbForTesting(openDatabase(":memory:"));
});

describe("password", () => {
  it("memverifikasi hash yang benar dan menolak yang salah", async () => {
    const hash = await hashPassword(PASSWORD);
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain(PASSWORD);
    expect(await verifyPassword(PASSWORD, hash)).toBe(true);
    expect(await verifyPassword("salah-total-123", hash)).toBe(false);
    expect(await verifyPassword(PASSWORD, "format-rusak")).toBe(false);
  });
});

describe("peran", () => {
  it("mengikuti hierarki viewer < analyst < admin", () => {
    expect(hasRole("admin", "analyst")).toBe(true);
    expect(hasRole("viewer", "analyst")).toBe(false);
    expect(can("viewer", "data:read")).toBe(true);
    expect(can("viewer", "finding:create")).toBe(false);
    expect(can("analyst", "finding:create")).toBe(true);
    expect(can("analyst", "user:manage")).toBe(false);
    expect(can("admin", "user:manage")).toBe(true);
  });
});

describe("pengguna & login", () => {
  it("menormalkan email dan menolak duplikat", async () => {
    await createUser({ email: " Admin@Contoh.ID ", name: "Admin", role: "admin", password: PASSWORD });
    await expect(
      createUser({ email: "admin@contoh.id", name: "Lain", role: "viewer", password: PASSWORD }),
    ).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
  });

  it("menolak kata sandi pendek", async () => {
    await expect(
      createUser({ email: "a@contoh.id", name: "A", role: "viewer", password: "pendek" }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("login sukses dengan kredensial benar, gagal generik bila salah", async () => {
    await createUser({ email: "a@contoh.id", name: "A", role: "analyst", password: PASSWORD });
    const ok = await authenticate("A@contoh.id", PASSWORD);
    expect(ok.ok && ok.user.role).toBe("analyst");
    expect(await authenticate("a@contoh.id", "salah-kata-sandi")).toEqual({ ok: false, reason: "invalid" });
    expect(await authenticate("tidakada@contoh.id", PASSWORD)).toEqual({ ok: false, reason: "invalid" });
  });

  it("mengunci setelah kegagalan beruntun, bahkan dengan kata sandi benar", async () => {
    await createUser({ email: "a@contoh.id", name: "A", role: "viewer", password: PASSWORD });
    for (let i = 0; i < LOCKOUT_MAX_FAILURES; i++) await authenticate("a@contoh.id", "salah-kata-sandi");
    expect(await authenticate("a@contoh.id", PASSWORD)).toEqual({ ok: false, reason: "locked" });
  });

  it("batas longgar: 9 kali salah belum terkunci; kunci lepas setelah jendela lewat", async () => {
    expect(LOCKOUT_MAX_FAILURES).toBe(10);
    expect(LOCKOUT_WINDOW_MS).toBe(5 * 60 * 1000);
    await createUser({ email: "a@contoh.id", name: "A", role: "viewer", password: PASSWORD });
    for (let i = 0; i < LOCKOUT_MAX_FAILURES - 1; i++) await authenticate("a@contoh.id", "salah-kata-sandi");
    expect(isLockedOut("a@contoh.id")).toBe(false);
    await authenticate("a@contoh.id", "salah-kata-sandi");
    expect(isLockedOut("a@contoh.id")).toBe(true);
    expect(isLockedOut("a@contoh.id", new Date(Date.now() + LOCKOUT_WINDOW_MS + 1000))).toBe(false);
  });
});

describe("sesi", () => {
  it("token valid mengembalikan pengguna; database hanya menyimpan hash", async () => {
    const user = await createUser({ email: "a@contoh.id", name: "A", role: "viewer", password: PASSWORD });
    const { token } = createSession(user.id);
    expect(validateSession(token)?.id).toBe(user.id);
    const stored = getDb().prepare("SELECT token_hash FROM sessions").get() as { token_hash: string };
    expect(stored.token_hash).toBe(hashToken(token));
    expect(stored.token_hash).not.toBe(token);
  });

  it("sesi kedaluwarsa, dicabut, atau pengguna nonaktif ditolak", async () => {
    const user = await createUser({ email: "a@contoh.id", name: "A", role: "viewer", password: PASSWORD });
    const start = new Date("2026-10-01T00:00:00Z");
    const { token } = createSession(user.id, start);
    expect(validateSession(token, new Date(start.getTime() + SESSION_TTL_MS + 1))).toBeNull();

    const second = createSession(user.id);
    revokeSession(second.token);
    expect(validateSession(second.token)).toBeNull();

    const third = createSession(user.id);
    getDb().prepare("UPDATE users SET status = 'disabled' WHERE id = ?").run(user.id);
    expect(validateSession(third.token)).toBeNull();
  });

  it("token kosong atau asing ditolak", () => {
    expect(validateSession(undefined)).toBeNull();
    expect(validateSession("bukan-token")).toBeNull();
  });
});

describe("undangan", () => {
  async function admin() {
    return createUser({ email: "admin@contoh.id", name: "Admin", role: "admin", password: PASSWORD });
  }

  it("undangan dipakai sekali dan membuat pengguna dengan peran undangan", async () => {
    const a = await admin();
    const { token } = createInvite({ email: "baru@contoh.id", role: "analyst", invitedBy: a.id });
    const user = await acceptInvite(token, { name: "Baru", password: PASSWORD });
    expect(user).toMatchObject({ email: "baru@contoh.id", role: "analyst" });
    expect(findPendingInvite(token)).toBeNull();
    await expect(acceptInvite(token, { name: "Lagi", password: PASSWORD })).rejects.toMatchObject({
      code: "INVITE_INVALID",
    });
  });

  it("undangan baru mencabut undangan lama untuk email yang sama", async () => {
    const a = await admin();
    const first = createInvite({ email: "x@contoh.id", role: "viewer", invitedBy: a.id });
    const second = createInvite({ email: "x@contoh.id", role: "viewer", invitedBy: a.id });
    expect(findPendingInvite(first.token)).toBeNull();
    expect(findPendingInvite(second.token)?.email).toBe("x@contoh.id");
  });

  it("undangan kedaluwarsa tidak berlaku dan email terdaftar tidak bisa diundang", async () => {
    const a = await admin();
    const past = new Date("2020-01-01T00:00:00Z");
    const { token } = createInvite({ email: "lama@contoh.id", role: "viewer", invitedBy: a.id }, past);
    expect(findPendingInvite(token)).toBeNull();
    expect(() => createInvite({ email: "admin@contoh.id", role: "viewer", invitedBy: a.id })).toThrow(AuthError);
  });

  it("kata sandi tidak valid tidak menghabiskan undangan", async () => {
    const a = await admin();
    const { token } = createInvite({ email: "y@contoh.id", role: "viewer", invitedBy: a.id });
    await expect(acceptInvite(token, { name: "Y", password: "pendek" })).rejects.toBeInstanceOf(AuthError);
    expect(findPendingInvite(token)).not.toBeNull();
  });

  it("audit tidak menyimpan token atau kata sandi", async () => {
    const a = await admin();
    const { token } = createInvite({ email: "z@contoh.id", role: "viewer", invitedBy: a.id });
    await acceptInvite(token, { name: "Z", password: PASSWORD });
    const dump = JSON.stringify(getDb().prepare("SELECT * FROM audit_entries").all());
    expect(dump).not.toContain(token);
    expect(dump).not.toContain(PASSWORD);
  });
});
