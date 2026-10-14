import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, authorize } from "@/lib/api/guard";
import { createReport, listReports, ReportError } from "@/lib/reports/service";

const noStore = { "Cache-Control": "private, no-store" };

export function GET(request: NextRequest) {
  const auth = authorize(request, "data:read");
  if (!auth.ok) return auth.response;
  return NextResponse.json({ ok: true, data: listReports() }, { headers: noStore });
}

/** Buat laporan (Analyst/Admin). Body: { idempotencyKey, params }. Mengembalikan laporan yang sama untuk key yang sama. */
export async function POST(request: NextRequest) {
  const auth = authorize(request, "report:create");
  if (!auth.ok) return auth.response;
  try {
    const { report, created } = createReport(await request.json().catch(() => null), auth.user.id);
    return NextResponse.json({ ok: true, data: { ...report, created } }, { status: created ? 202 : 200, headers: noStore });
  } catch (error) {
    if (error instanceof ReportError) return apiError(400, error.code === "INVALID_RANGE" ? "INVALID_RANGE" : "INVALID_INPUT", error.message);
    throw error;
  }
}
