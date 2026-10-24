import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorize } from "@/lib/api/guard";
import { getActivityStats, listActivities } from "@/lib/cms/activity";
import type { ActivityCategory } from "@/lib/cms/types";

const noStore = { "Cache-Control": "private, no-store" };

/** GET /api/cms/activity — Mengambil daftar log aktivitas terpaginasi & statistik */
export function GET(request: NextRequest) {
  const auth = authorize(request, "cms:manage");
  if (!auth.ok) return auth.response;

  const sp = request.nextUrl.searchParams;
  const category = (sp.get("category") || "all") as ActivityCategory;
  const timeRange = (sp.get("timeRange") || "all") as "all" | "today" | "7d" | "30d";
  const search = sp.get("search") || undefined;
  const actorId = sp.get("actorId") || undefined;
  const page = parseInt(sp.get("page") || "1", 10) || 1;
  const pageSize = parseInt(sp.get("pageSize") || "20", 10) || 20;

  const data = listActivities({
    category,
    timeRange,
    search,
    actorId,
    page,
    pageSize,
  });

  const stats = getActivityStats();

  return NextResponse.json({ ok: true, data, stats }, { headers: noStore });
}
