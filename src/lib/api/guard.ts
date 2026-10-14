import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { can, type Permission } from "@/lib/auth/roles";
import { validateSession, type SafeUser } from "@/lib/auth/service";
import { SESSION_COOKIE } from "@/lib/auth/session";

/** Kode error internal (PRD §12); body upstream mentah tidak pernah diteruskan. */
export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "BAD_ORIGIN"
  | "INVALID_INPUT"
  | "CONFLICT"
  | "NOT_FOUND"
  | "SOURCE_UNAVAILABLE"
  | "UNSUPPORTED_CAPABILITY"
  | "RATE_LIMITED"
  | "INVALID_RANGE"
  | "PARTIAL_RESULT";

export function apiError(status: number, code: ApiErrorCode, message: string, retryable = false) {
  return NextResponse.json({ ok: false, error: { code, message, retryable } }, { status });
}

/**
 * Mutation hanya diterima dari origin yang sama (perlindungan CSRF, PRD §15).
 * Browser selalu mengirim header Origin pada POST/PATCH/DELETE; tanpa Origin ditolak.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

type GuardResult = { ok: true; user: SafeUser } | { ok: false; response: NextResponse };

/** Periksa sesi, izin, dan origin di setiap Route Handler terlindungi. */
export function authorize(request: NextRequest, permission: Permission): GuardResult {
  const method = request.method.toUpperCase();
  const isMutation = !["GET", "HEAD", "OPTIONS"].includes(method);
  if (isMutation && !isSameOrigin(request)) {
    return { ok: false, response: apiError(403, "BAD_ORIGIN", "Permintaan ditolak: origin tidak sesuai.") };
  }
  const user = validateSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return { ok: false, response: apiError(401, "UNAUTHENTICATED", "Sesi tidak ditemukan atau kedaluwarsa.") };
  if (!can(user.role, permission)) {
    return { ok: false, response: apiError(403, "FORBIDDEN", "Peran Anda tidak memiliki izin untuk tindakan ini.") };
  }
  return { ok: true, user };
}
