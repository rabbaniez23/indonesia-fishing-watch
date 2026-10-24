import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, authorize } from "@/lib/api/guard";
import { deleteArticle, getArticleById, updateArticle } from "@/lib/cms/articles";

const noStore = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest, ctx: RouteContext<"/api/cms/articles/[id]">) {
  const auth = authorize(request, "data:read");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const article = getArticleById(id);
  if (!article) return apiError(404, "NOT_FOUND", "Artikel tidak ditemukan.");

  return NextResponse.json({ ok: true, data: article }, { headers: noStore });
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/cms/articles/[id]">) {
  const auth = authorize(request, "dataset:import");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError(400, "INVALID_INPUT", "Data perubahan tidak valid.");
    }

    const updated = updateArticle(id, body, auth.user.id);
    if (!updated) return apiError(404, "NOT_FOUND", "Artikel tidak ditemukan.");

    return NextResponse.json({ ok: true, data: updated }, { headers: noStore });
  } catch (error) {
    return apiError(500, "CONFLICT", error instanceof Error ? error.message : "Gagal memperbarui artikel.");
  }
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/cms/articles/[id]">) {
  const auth = authorize(request, "dataset:import");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const success = deleteArticle(id, auth.user.id);
  if (!success) return apiError(404, "NOT_FOUND", "Artikel tidak ditemukan atau gagal dihapus.");

  return NextResponse.json({ ok: true, message: "Artikel berhasil dihapus." }, { headers: noStore });
}
