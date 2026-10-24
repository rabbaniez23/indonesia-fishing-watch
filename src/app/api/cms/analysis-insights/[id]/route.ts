import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, authorize } from "@/lib/api/guard";
import {
  deleteAnalysisInsight,
  getAnalysisInsightById,
  updateAnalysisInsight,
} from "@/lib/cms/analysis-insights";

const noStore = { "Cache-Control": "private, no-store" };

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/cms/analysis-insights/[id]">,
) {
  const auth = authorize(request, "data:read");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const insight = getAnalysisInsightById(id);
  if (!insight) return apiError(404, "NOT_FOUND", "Catatan analisis tidak ditemukan.");

  return NextResponse.json({ ok: true, data: insight }, { headers: noStore });
}

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/cms/analysis-insights/[id]">,
) {
  const auth = authorize(request, "cms:manage");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError(400, "INVALID_INPUT", "Data perubahan tidak valid.");
    }

    const updated = updateAnalysisInsight({
      id,
      ...body,
      userId: auth.user.id,
    });

    return NextResponse.json({ ok: true, data: updated }, { headers: noStore });
  } catch (error) {
    return apiError(
      400,
      "INVALID_INPUT",
      error instanceof Error ? error.message : "Gagal memperbarui catatan analisis.",
    );
  }
}

export async function DELETE(
  request: NextRequest,
  ctx: RouteContext<"/api/cms/analysis-insights/[id]">,
) {
  const auth = authorize(request, "cms:manage");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const deleted = deleteAnalysisInsight(id, auth.user.id);
  if (!deleted) return apiError(404, "NOT_FOUND", "Catatan analisis tidak ditemukan.");

  return NextResponse.json({ ok: true, message: "Catatan analisis berhasil dihapus." }, { headers: noStore });
}
