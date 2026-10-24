import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorize } from "@/lib/api/guard";
import { exportActivitiesCsv } from "@/lib/cms/activity";
import type { ActivityCategory } from "@/lib/cms/types";

/** GET /api/cms/activity/export — Unduh berkas CSV log audit aktivitas */
export function GET(request: NextRequest) {
  const auth = authorize(request, "cms:manage");
  if (!auth.ok) return auth.response;

  const sp = request.nextUrl.searchParams;
  const category = (sp.get("category") || "all") as ActivityCategory;
  const timeRange = (sp.get("timeRange") || "all") as "all" | "today" | "7d" | "30d";
  const search = sp.get("search") || undefined;
  const actorId = sp.get("actorId") || undefined;

  const csv = exportActivitiesCsv({
    category,
    timeRange,
    search,
    actorId,
  });

  const todayStr = new Date().toISOString().split("T")[0];
  const filename = `aktivitas-cms-${todayStr}.csv`;

  return new NextResponse(`\uFEFF${csv}`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
