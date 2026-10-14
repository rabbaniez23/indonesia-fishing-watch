import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, authorize } from "@/lib/api/guard";
import { getReportResult } from "@/lib/analysis/report-jobs";

/** Snapshot hasil report beserta provenance (immutable). */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/analysis/results/[id]">) {
  const auth = authorize(request, "data:read");
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const result = getReportResult(id, true);
  if (!result) return apiError(404, "NOT_FOUND", "Hasil tidak ditemukan.");
  return NextResponse.json({ ok: true, data: result }, { headers: { "Cache-Control": "private, no-store" } });
}
