"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/audit";
import { acceptInvite, authenticate, AuthError, createSession, LOCKOUT_WINDOW_MS, revokeSession, validateSession } from "./service";
import { clearSessionCookie, safeNextPath, SESSION_COOKIE, setSessionCookie } from "./session";

export type FormState = { error: string | null };

function field(formData: FormData, name: string, max = 512): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.slice(0, max) : "";
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = field(formData, "email", 254);
  const password = field(formData, "password", 256);
  const next = safeNextPath(formData.get("next"));

  const result = await authenticate(email, password);
  if (!result.ok) {
    return {
      error:
        result.reason === "locked"
          ? `Terlalu banyak percobaan gagal. Coba lagi dalam ${LOCKOUT_WINDOW_MS / 60_000} menit.`
          : "Email atau kata sandi salah.",
    };
  }
  const session = createSession(result.user.id);
  await setSessionCookie(session.token, session.expiresAt);
  recordAudit({ actorId: result.user.id, action: "session.login", entityType: "user", entityId: result.user.id });
  redirect(next);
}

export async function logoutAction(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    const user = validateSession(token);
    revokeSession(token);
    if (user) recordAudit({ actorId: user.id, action: "session.logout", entityType: "user", entityId: user.id });
  }
  await clearSessionCookie();
  redirect("/login");
}

export async function acceptInviteAction(token: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const name = field(formData, "name", 120);
  const password = field(formData, "password", 256);
  const confirm = field(formData, "confirm", 256);
  if (password !== confirm) return { error: "Konfirmasi kata sandi tidak sama." };

  try {
    const user = await acceptInvite(token, { name, password });
    const session = createSession(user.id);
    await setSessionCookie(session.token, session.expiresAt);
  } catch (error) {
    if (error instanceof AuthError) return { error: error.message };
    throw error;
  }
  redirect("/overview");
}
