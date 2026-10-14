import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, authorize } from "@/lib/api/guard";
import { getReportResult } from "@/lib/analysis/report-jobs";
import { getJob } from "@/lib/jobs/queue";

/** Status job + metadata hasil (tanpa payload besar). Payload diambil lewat /api/analysis/results/:id. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/analysis/jobs/[id]">) {
  const auth = authorize(request, "data:read");
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const job = getJob(id);
  if (!job) return apiError(404, "NOT_FOUND", "Job tidak ditemukan.");
  const result = job.resultRef ? getReportResult(job.resultRef, false) : null;
  return NextResponse.json(
    {
      ok: true,
      data: {
        id: job.id,
        type: job.type,
        state: job.state,
        params: job.params,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        runAfter: job.runAfter,
        error: job.errorCode ? { code: job.errorCode, message: job.errorMessage } : null,
        createdAt: job.createdAt,
        finishedAt: job.finishedAt,
        result,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
