/**
 * Dua peran: Pengguna ⊂ Admin.
 * - Pengguna: membaca semua menu, membuat Temuan, mengunduh & membuat Laporan.
 * - Admin: semua hak Pengguna + CMS (dataset, lapisan peta, artikel, catatan analisis, log) + kelola akun & sistem.
 * Viewer & Analyst lama dipetakan ke 'user' oleh migrasi 12.
 */
export const ROLES = ["user", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  user: "Pengguna",
  admin: "Admin",
};

const RANK: Record<Role, number> = { user: 0, admin: 1 };

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** true jika `role` setidaknya setara `minimum`. */
export function hasRole(role: Role, minimum: Role): boolean {
  return RANK[role] >= RANK[minimum];
}

/** Aksi yang memerlukan peran tertentu; satu sumber kebenaran untuk UI dan server. */
export const PERMISSIONS = {
  "data:read": "user",
  "report:download": "user",
  "finding:create": "user",
  "finding:note": "user",
  "finding:update": "user",
  "report:create": "user",
  "cms:manage": "admin",
  "user:manage": "admin",
  "dataset:manage": "admin",
} as const satisfies Record<string, Role>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return hasRole(role, PERMISSIONS[permission]);
}
