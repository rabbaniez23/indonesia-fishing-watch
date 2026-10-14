import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession, type SafeUser } from "./service";

export const SESSION_COOKIE = "ifw_session";

/**
 * Data Access Layer sesi. Dibaca ulang di server pada setiap request (tidak di-cache lintas request)
 * sehingga pencabutan sesi atau perubahan peran langsung berlaku.
 */
export const getCurrentUser = cache(async (): Promise<SafeUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return validateSession(token);
});

export async function requireUser(): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Validasi tujuan redirect agar hanya path internal (mencegah open redirect). */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/overview";
  }
  return value.length > 512 ? "/overview" : value;
}
