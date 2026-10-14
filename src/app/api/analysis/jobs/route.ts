import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, authorize } from "@/lib/api/guard";
import { ReportJobError, requestReport } from "@/lib/analysis/report-jobs";
import { PortJobError, requestPortVisits } from "@/lib/ports/port-jobs";

/**
 * Antrekan report analisis (PRD §12). Tidak pernah memanggil GFW di request web:
 * hasil fresh dikembalikan langsung; selain itu job diantre (dedup per parameter) dan diproses worker.
 */
export async function POST(request: NextRequest) {
  const auth = authorize(request, "data:read");
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  try {
    if (body && typeof body === "object" && (body as { type?: unknown }).type === "port_visits") {
      const out = requestPortVisits(body, auth.user.id);
      if (out.status === "fresh") return NextResponse.json({ ok: true, data: { status: "fresh", resultId: out.resultId } });
      return NextResponse.json(
        { ok: true, data: { status: out.job.state, jobId: out.job.id, created: out.created, staleResultId: null } },
        { status: out.created ? 202 : 200 },
      );
    }
    const outcome = requestReport(body, auth.user.id);
    if (outcome.status === "fresh") {
      return NextResponse.json({ ok: true, data: { status: "fresh", resultId: outcome.result.id, result: outcome.result } });
    }
    return NextResponse.json(
      {
        ok: true,
        data: {
          status: outcome.job.state,
          jobId: outcome.job.id,
          created: outcome.created,
          staleResultId: outcome.stale?.id ?? null,
        },
      },
      { status: outcome.created ? 202 : 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      const rangeIssue = error.issues.find((i) => /Rentang|Tanggal/.test(i.message));
      return apiError(400, rangeIssue ? "INVALID_RANGE" : "INVALID_INPUT", rangeIssue?.message ?? "Parameter analisis tidak valid.");
    }
    if (error instanceof ReportJobError || error instanceof PortJobError) return apiError(400, "INVALID_INPUT", error.message);
    throw error;
  }
}
