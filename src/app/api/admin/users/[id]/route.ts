import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, authorize } from "@/lib/api/guard";
import { ROLES } from "@/lib/auth/roles";
import { AuthError, updateUserAccess } from "@/lib/auth/service";

const bodySchema = z
  .object({ role: z.enum(ROLES).optional(), status: z.enum(["active", "disabled"]).optional() })
  .refine((v) => v.role !== undefined || v.status !== undefined, { message: "Tidak ada perubahan." });

/** Admin mengubah peran/status pengguna lain; menonaktifkan mencabut sesi. */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) {
  const auth = authorize(request, "user:manage");
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_INPUT", parsed.error.issues[0]?.message ?? "Input tidak valid.");
  try {
    return NextResponse.json({ ok: true, data: updateUserAccess(auth.user.id, id, parsed.data) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthError) return apiError(400, "INVALID_INPUT", error.message);
    throw error;
  }
}
