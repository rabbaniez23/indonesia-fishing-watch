import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorize } from "@/lib/api/guard";
import { createArticle, listArticles } from "@/lib/cms/articles";
import { ARTICLE_CATEGORIES, type ArticleCategory, type ArticleStatus } from "@/lib/cms/types";

const noStore = { "Cache-Control": "private, no-store" };

/** GET /api/cms/articles — Daftar artikel panduan & riset */
export function GET(request: NextRequest) {
  const auth = authorize(request, "data:read");
  if (!auth.ok) return auth.response;

  const category = request.nextUrl.searchParams.get("category");
  const status = request.nextUrl.searchParams.get("status");

  const validCategory =
    category && (ARTICLE_CATEGORIES as readonly string[]).includes(category)
      ? (category as ArticleCategory)
      : undefined;

  const validStatus =
    status && ["draft", "published", "archived"].includes(status)
      ? (status as ArticleStatus)
      : undefined;

  const articles = listArticles({ category: validCategory, status: validStatus });
  return NextResponse.json({ ok: true, data: articles }, { headers: noStore });
}

/** POST /api/cms/articles — Peneliti/Admin membuat artikel panduan/riset baru */
export async function POST(request: NextRequest) {
  const auth = authorize(request, "cms:manage");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_INPUT", message: "Data permintaan tidak valid." } },
        { status: 400, headers: noStore },
      );
    }

    const { title, slug, category, excerpt, contentHtml, coverImage, status } = body;

    if (!title || typeof title !== "string" || title.trim().length < 3) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_INPUT", message: "Judul artikel minimal 3 karakter." } },
        { status: 400, headers: noStore },
      );
    }

    if (!category || !(ARTICLE_CATEGORIES as readonly string[]).includes(category)) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_INPUT", message: "Kategori artikel tidak valid." } },
        { status: 400, headers: noStore },
      );
    }

    if (!contentHtml || typeof contentHtml !== "string" || contentHtml.trim().length < 5) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_INPUT", message: "Isi konten artikel wajib diisi." } },
        { status: 400, headers: noStore },
      );
    }

    const created = createArticle({
      title: title.trim(),
      slug: typeof slug === "string" ? slug.trim() : undefined,
      category,
      excerpt: typeof excerpt === "string" ? excerpt.trim() : undefined,
      contentHtml,
      coverImage: typeof coverImage === "string" ? coverImage.trim() : undefined,
      status: typeof status === "string" ? (status as ArticleStatus) : "draft",
      userId: auth.user.id,
    });

    return NextResponse.json({ ok: true, data: created }, { status: 201, headers: noStore });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "SERVER_ERROR",
          message: error instanceof Error ? error.message : "Gagal membuat artikel.",
        },
      },
      { status: 500, headers: noStore },
    );
  }
}
