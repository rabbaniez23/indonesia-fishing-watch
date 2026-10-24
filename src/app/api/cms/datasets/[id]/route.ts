import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, authorize } from "@/lib/api/guard";
import { deleteResearchDataset, getResearchDatasetById, getResearchDatasetContent } from "@/lib/cms/datasets";

const noStore = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest, ctx: RouteContext<"/api/cms/datasets/[id]">) {
  const auth = authorize(request, "data:read");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const download = request.nextUrl.searchParams.get("download") === "1";

  if (download) {
    const raw = getResearchDatasetContent(id);
    if (!raw) return apiError(404, "NOT_FOUND", "File dataset tidak ditemukan.");

    const mime = raw.fileType === "geojson" ? "application/geo+json" : raw.fileType === "csv" ? "text/csv" : "application/json";
    return new NextResponse(raw.content, {
      headers: {
        "Content-Type": `${mime}; charset=utf-8`,
        "Content-Disposition": `attachment; filename="${raw.fileName}"`,
      },
    });
  }

  const dataset = getResearchDatasetById(id);
  if (!dataset) return apiError(404, "NOT_FOUND", "Dataset riset tidak ditemukan.");

  return NextResponse.json({ ok: true, data: dataset }, { headers: noStore });
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/cms/datasets/[id]">) {
  const auth = authorize(request, "dataset:import");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const success = deleteResearchDataset(id, auth.user.id);
  if (!success) return apiError(404, "NOT_FOUND", "Dataset tidak ditemukan atau gagal dihapus.");

  return NextResponse.json({ ok: true, message: "Dataset berhasil dihapus." }, { headers: noStore });
}
