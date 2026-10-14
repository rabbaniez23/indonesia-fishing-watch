import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, authorize } from "@/lib/api/guard";
import { getReport } from "@/lib/reports/service";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/reports/[id]">) {
  const auth = authorize(request, "data:read");
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const report = getReport(id);
  if (!report) return apiError(404, "NOT_FOUND", "Laporan tidak ditemukan.");
  return NextResponse.json({ ok: true, data: report }, { headers: { "Cache-Control": "private, no-store" } });
}
