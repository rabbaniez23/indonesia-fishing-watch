import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, authorize } from "@/lib/api/guard";
import { findingErrorResponse } from "@/lib/findings/errors";
import { getFinding, updateFinding } from "@/lib/findings/service";

const noStore = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest, ctx: RouteContext<"/api/findings/[id]">) {
  const auth = authorize(request, "data:read");
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const finding = getFinding(id);
  if (!finding) return apiError(404, "NOT_FOUND", "Temuan tidak ditemukan.");
  return NextResponse.json({ ok: true, data: finding }, { headers: noStore });
}

/** PATCH status/prioritas dengan version guard (409 bila versi usang). */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/findings/[id]">) {
  const auth = authorize(request, "finding:update");
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const finding = updateFinding(id, await request.json().catch(() => null), auth.user.id);
    return NextResponse.json({ ok: true, data: finding }, { headers: noStore });
  } catch (error) {
    return findingErrorResponse(error);
  }
}
