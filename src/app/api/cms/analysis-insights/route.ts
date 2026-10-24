import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorize } from "@/lib/api/guard";
import { createAnalysisInsight, listAnalysisInsights } from "@/lib/cms/analysis-insights";
import type { InsightTab } from "@/lib/cms/types";

const noStore = { "Cache-Control": "private, no-store" };

/** GET /api/cms/analysis-insights — Ambil daftar catatan analisis */
export function GET(request: NextRequest) {
  const auth = authorize(request, "data:read");
  if (!auth.ok) return auth.response;

  const sp = request.nextUrl.searchParams;
  const tab = (sp.get("tab") || undefined) as InsightTab | undefined;
  const regionId = sp.get("regionId") || undefined;
  const activeParam = sp.get("isActive");
  const isActive = activeParam !== null ? activeParam === "true" : undefined;

  const insights = listAnalysisInsights({ tab, regionId, isActive });
  return NextResponse.json({ ok: true, data: insights }, { headers: noStore });
}

/** POST /api/cms/analysis-insights — Buat catatan analisis baru */
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

    const { title, content, kind, tab, regionId, metric, periodStart, periodEnd, isActive } = body;

    if (!title || !content || !kind || !tab) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "VALIDATION_FAILED",
            message: "Judul, isi narasi, jenis insight, dan tab target wajib diisi.",
          },
        },
        { status: 400, headers: noStore },
      );
    }

    const insight = createAnalysisInsight({
      title,
      content,
      kind,
      tab,
      regionId,
      metric,
      periodStart,
      periodEnd,
      isActive: isActive !== false,
      userId: auth.user.id,
    });

    return NextResponse.json({ ok: true, data: insight }, { status: 201, headers: noStore });
  } catch {
    // Detail error internal tidak dikirim ke browser.
    return NextResponse.json(
      { ok: false, error: { code: "SERVER_ERROR", message: "Gagal menyimpan catatan." } },
      { status: 500, headers: noStore },
    );
  }
}
