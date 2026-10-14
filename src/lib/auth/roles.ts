/** Peran MVP (PRD §4): Viewer ⊂ Analyst ⊂ Admin. */
export const ROLES = ["viewer", "analyst", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  viewer: "Viewer",
  analyst: "Analyst",
  admin: "Admin",
};

const RANK: Record<Role, number> = { viewer: 0, analyst: 1, admin: 2 };

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** true jika `role` setidaknya setara `minimum`. */
export function hasRole(role: Role, minimum: Role): boolean {
  return RANK[role] >= RANK[minimum];
}

/** Aksi yang memerlukan peran tertentu; satu sumber kebenaran untuk UI dan server. */
export const PERMISSIONS = {
  "data:read": "viewer",
  "report:download": "viewer",
  "finding:create": "analyst",
  "finding:note": "analyst",
  "finding:update": "analyst",
  "report:create": "analyst",
  "user:manage": "admin",
  "dataset:manage": "admin",
} as const satisfies Record<string, Role>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return hasRole(role, PERMISSIONS[permission]);
}
