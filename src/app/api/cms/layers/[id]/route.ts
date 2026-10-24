import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, authorize } from "@/lib/api/guard";
import { deleteCustomLayer, getCustomLayerById, updateCustomLayer } from "@/lib/cms/layers";

const noStore = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest, ctx: RouteContext<"/api/cms/layers/[id]">) {
  const auth = authorize(request, "data:read");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const layer = getCustomLayerById(id);
  if (!layer) return apiError(404, "NOT_FOUND", "Lapisan peta tidak ditemukan.");

  return NextResponse.json({ ok: true, data: layer }, { headers: noStore });
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/cms/layers/[id]">) {
  const auth = authorize(request, "cms:manage");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError(400, "INVALID_INPUT", "Data perubahan tidak valid.");
    }

    const updated = updateCustomLayer(id, body, auth.user.id);
    if (!updated) return apiError(404, "NOT_FOUND", "Lapisan peta tidak ditemukan.");

    return NextResponse.json({ ok: true, data: updated }, { headers: noStore });
  } catch (error) {
    return apiError(500, "CONFLICT", error instanceof Error ? error.message : "Gagal memperbarui lapisan.");
  }
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/cms/layers/[id]">) {
  const auth = authorize(request, "cms:manage");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const success = deleteCustomLayer(id, auth.user.id);
  if (!success) return apiError(404, "NOT_FOUND", "Lapisan peta tidak ditemukan atau gagal dihapus.");

  return NextResponse.json({ ok: true, message: "Lapisan peta berhasil dihapus." }, { headers: noStore });
}
