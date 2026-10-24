import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { migrate } from "./index";
import { MIGRATIONS } from "./migrations";

/** Database pada versi `upTo` (seperti server sebelum rilis berikutnya). */
function databaseAt(upTo: number): DatabaseSync {
  const db = new DatabaseSync(":memory:", { enableForeignKeyConstraints: true });
  db.exec("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);");
  for (const m of MIGRATIONS.filter((x) => x.version <= upTo)) {
    db.exec(m.sql);
    db.prepare("INSERT INTO schema_migrations VALUES (?, ?, ?)").run(m.version, m.name, "2026-10-01T00:00:00Z");
  }
  return db;
}

describe("migrasi 12: peran Pengguna & Admin", () => {
  it("Viewer/Analyst menjadi 'user', Admin tetap; sesi & undangan selamat; foreign key utuh", () => {
    const db = databaseAt(11);
    const t = "2026-10-01T00:00:00Z";
    const addUser = db.prepare("INSERT INTO users VALUES (?, ?, ?, ?, 'hash', 'active', ?, ?)");
    addUser.run("a", "admin@uji.local", "Admin", "admin", t, t);
    addUser.run("b", "analis@uji.local", "Analis", "analyst", t, t);
    addUser.run("c", "viewer@uji.local", "Viewer", "viewer", t, t);
    db.prepare("INSERT INTO sessions VALUES ('s1', 'th1', 'b', ?, '2099-01-01T00:00:00Z', ?)").run(t, t);
    db.prepare("INSERT INTO invites (id, email, role, token_hash, invited_by, created_at, expires_at) VALUES ('i1', 'x@uji.local', 'viewer', 'ih1', 'a', ?, ?)").run(t, t);

    expect(migrate(db)).toContain(12);

    const roles = db.prepare("SELECT id, role FROM users ORDER BY id").all() as Array<{ id: string; role: string }>;
    expect(roles.map((r) => `${r.id}:${r.role}`)).toEqual(["a:admin", "b:user", "c:user"]);
    expect((db.prepare("SELECT role FROM invites WHERE id = 'i1'").get() as { role: string }).role).toBe("user");
    expect(db.prepare("SELECT COUNT(*) AS n FROM sessions").get()).toEqual({ n: 1 });
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    expect((db.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number }).foreign_keys).toBe(1);
    // Batasan baru berlaku; foreign key ke users tetap aktif setelah tabel dibangun ulang.
    expect(() => addUser.run("d", "lama@uji.local", "Lama", "analyst", t, t)).toThrow();
    expect(() => db.prepare("INSERT INTO sessions VALUES ('s2', 'th2', 'tidak-ada', ?, ?, ?)").run(t, t, t)).toThrow();
    db.prepare("DELETE FROM users WHERE id = 'b'").run();
    expect(db.prepare("SELECT COUNT(*) AS n FROM sessions").get()).toEqual({ n: 0 });
  });
});
