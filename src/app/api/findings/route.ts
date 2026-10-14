import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorize } from "@/lib/api/guard";
import { findingErrorResponse } from "@/lib/findings/errors";
import { STATUSES, type FindingStatus } from "@/lib/findings/model";
import { createFinding, listFindings } from "@/lib/findings/service";

const noStore = { "Cache-Control": "private, no-store" };

/** GET /api/findings?status= — semua peran dapat membaca (data privat workspace, tidak di-cache publik). */
export function GET(request: NextRequest) {
  const auth = authorize(request, "data:read");
  if (!auth.ok) return auth.response;
  const status = request.nextUrl.searchParams.get("status");
  const filter = status && (STATUSES as readonly string[]).includes(status) ? { status: status as FindingStatus } : {};
  return NextResponse.json({ ok: true, data: listFindings(filter) }, { headers: noStore });
}

/** POST /api/findings — Analyst/Admin; aktor dari sesi server, bukan dari body. */
export async function POST(request: NextRequest) {
  const auth = authorize(request, "finding:create");
  if (!auth.ok) return auth.response;
  try {
    const finding = createFinding(await request.json().catch(() => null), auth.user.id);
    return NextResponse.json({ ok: true, data: finding }, { status: 201, headers: noStore });
  } catch (error) {
    return findingErrorResponse(error);
  }
}
