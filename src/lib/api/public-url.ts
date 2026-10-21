import type { NextRequest } from "next/server";

/** Host publik dari APP_BASE_URL (mis. di balik tunnel HTTPS yang mengubah header Host). */
export function publicHost(): string | null {
  try {
    return process.env.APP_BASE_URL ? new URL(process.env.APP_BASE_URL).host : null;
  } catch {
    return null;
  }
}

/**
 * Origin untuk tautan yang dibagikan ke luar (mis. undangan). Di balik tunnel, request.nextUrl berisi alamat internal
 * (https://localhost:3000), jadi APP_BASE_URL diutamakan.
 */
export function publicOrigin(request: NextRequest): string {
  try {
    if (process.env.APP_BASE_URL) return new URL(process.env.APP_BASE_URL).origin;
  } catch {
    // APP_BASE_URL rusak → pakai origin request.
  }
  return request.nextUrl.origin;
}
