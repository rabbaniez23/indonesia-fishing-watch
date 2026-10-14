import { recordAudit } from "@/lib/audit";
import { getDb, nowIso } from "@/lib/db";

/** Pengaturan workspace yang dapat diubah Admin (PRD §11.5, DS §10.9). Tidak pernah menyimpan secret. */

export const BUDGET_KEY = "gfw_daily_budget";
export const BUDGET_MIN = 100;
export const BUDGET_MAX = 50_000; // batas harian GFW per pengguna (dokumentasi License & Rate Limits)

export function getSetting(key: string): string | null {
  try {
    const row = getDb().prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as { value: string } | undefined;
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export function setSetting(key: string, value: string, actorId: string) {
  const previous = getSetting(key);
  getDb()
    .prepare(
      `INSERT INTO app_settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    )
    .run(key, value, actorId, nowIso());
  recordAudit({ actorId, action: "settings.update", entityType: "setting", entityId: key, changes: { from: previous, to: value } });
}

export function setDailyBudget(value: number, actorId: string) {
  if (!Number.isInteger(value) || value < BUDGET_MIN || value > BUDGET_MAX) {
    throw new Error(`Budget harian harus bilangan bulat ${BUDGET_MIN}–${BUDGET_MAX}.`);
  }
  setSetting(BUDGET_KEY, String(value), actorId);
}
