import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorize } from "@/lib/api/guard";
import { findingErrorResponse } from "@/lib/findings/errors";
import { addNote } from "@/lib/findings/service";

/** POST catatan append-only; aktor dari sesi server. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/findings/[id]/notes">) {
  const auth = authorize(request, "finding:note");
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const finding = addNote(id, await request.json().catch(() => null), auth.user.id);
    return NextResponse.json({ ok: true, data: finding }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return findingErrorResponse(error);
  }
}
