import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { MIGRATIONS } from "./migrations";

/**
 * Akses SQLite memakai modul bawaan Node (`node:sqlite`), tanpa dependensi native.
 * Dipakai oleh Next.js (server) dan skrip CLI/worker; modul ini sengaja tidak memakai
 * `server-only` agar bisa diimpor dari skrip `tsx`.
 */

export type Db = DatabaseSync;

const DEFAULT_PATH = path.join(process.cwd(), "data", "indonesia-fishing-watch.db");
/** Nama file sebelum aplikasi berganti nama (14 Okt 2026); dipakai selama file baru belum ada. */
const LEGACY_PATH = path.join(process.cwd(), "data", "pantau-laut.db");

function defaultPath(): string {
  return !existsSync(DEFAULT_PATH) && existsSync(LEGACY_PATH) ? LEGACY_PATH : DEFAULT_PATH;
}

let instance: Db | null = null;

export function openDatabase(filePath: string): Db {
  if (filePath !== ":memory:") mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new DatabaseSync(filePath, { enableForeignKeyConstraints: true, timeout: 5000 });
  if (filePath !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  migrate(db);
  return db;
}

/** Singleton per proses. Path dapat diatur lewat env DATABASE_PATH. */
export function getDb(): Db {
  if (!instance) instance = openDatabase(process.env.DATABASE_PATH || defaultPath());
  return instance;
}

/** Hanya untuk test: ganti instance (mis. database :memory:). */
export function setDbForTesting(db: Db | null): void {
  instance = db;
}

export function migrate(db: Db): number[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  );`);
  const applied = new Set(
    (db.prepare("SELECT version FROM schema_migrations").all() as Array<{ version: number }>).map((r) => r.version),
  );
  const ran: number[] = [];
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    transaction(db, () => {
      db.exec(migration.sql);
      db.prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)").run(
        migration.version,
        migration.name,
        nowIso(),
      );
    });
    ran.push(migration.version);
  }
  return ran;
}

let savepointSeq = 0;
const activeTransactions = new WeakSet<Db>();

if (!("isTransaction" in DatabaseSync.prototype)) {
  Object.defineProperty(DatabaseSync.prototype, "isTransaction", {
    get() {
      return activeTransactions.has(this as Db);
    },
    configurable: true,
  });
}

/**
 * Jalankan fn dalam satu transaksi; rollback bila melempar error.
 * Dapat dipanggil bersarang: di dalam transaksi aktif dipakai SAVEPOINT (rollback hanya bagian dalam).
 */
export function transaction<T>(db: Db, fn: () => T): T {
  if (activeTransactions.has(db)) {
    const name = `sp_${++savepointSeq}`;
    db.exec(`SAVEPOINT ${name}`);
    try {
      const result = fn();
      db.exec(`RELEASE ${name}`);
      return result;
    } catch (error) {
      db.exec(`ROLLBACK TO ${name}`);
      db.exec(`RELEASE ${name}`);
      throw error;
    }
  }
  activeTransactions.add(db);
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    activeTransactions.delete(db);
  }
}

export function nowIso(date: Date = new Date()): string {
  return date.toISOString();
}

export function newId(): string {
  return crypto.randomUUID();
}
