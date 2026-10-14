import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, authorize } from "@/lib/api/guard";
import { ROLES } from "@/lib/auth/roles";
import { AuthError, createInvite } from "@/lib/auth/service";

const bodySchema = z.object({
  email: z.string().trim().max(254),
  role: z.enum(ROLES),
});

/** Admin membuat undangan; tautan hanya ditampilkan sekali (token tidak disimpan mentah). */
export async function POST(request: NextRequest) {
  const auth = authorize(request, "user:manage");
  if (!auth.ok) return auth.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_INPUT", "Email dan peran wajib diisi dengan benar.");

  try {
    const { token, invite } = createInvite({ ...parsed.data, invitedBy: auth.user.id });
    return NextResponse.json(
      {
        ok: true,
        data: { invite, inviteUrl: `${request.nextUrl.origin}/invite/${token}` },
      },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.code === "EMAIL_TAKEN" ? 409 : 400, error.code === "EMAIL_TAKEN" ? "CONFLICT" : "INVALID_INPUT", error.message);
    }
    throw error;
  }
}
