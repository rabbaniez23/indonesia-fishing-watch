import { findLatestJob } from "@/lib/jobs/queue";
import type { ReportPayload } from "./aggregate";
import {
  findFreshResult,
  findLatestResult,
  getReportResult,
  reportDedupKey,
  type ReportJobParams,
  type ReportResult,
} from "./report-jobs";

/**
 * Status satu "bagian" report dari snapshot tersimpan (tanpa efek samping). Dipakai halaman (Ringkasan, Peta)
 * dan job ekspor laporan agar CSV memakai snapshot yang sama dengan UI.
 */

export type PartStatus = "ready" | "stale" | "pending" | "failed";

export type Part<P extends ReportPayload = ReportPayload> = {
  params: ReportJobParams;
  status: PartStatus;
  /** Ada bila status ready/stale. */
  result: (ReportResult & { payload: P }) | null;
  error: { code: string; message: string } | null;
};

export function loadPart<P extends ReportPayload>(params: ReportJobParams, geometryHash: string): Part<P> {
  const dedupKey = reportDedupKey(params, geometryHash);
  const fresh = findFreshResult(dedupKey);
  if (fresh) {
    return { params, status: "ready", result: getReportResult(fresh.id, true) as Part<P>["result"], error: null };
  }
  const latestJob = findLatestJob(dedupKey);
  const stale = findLatestResult(dedupKey);
  const staleResult = stale ? (getReportResult(stale.id, true) as Part<P>["result"]) : null;
  if (latestJob?.state === "failed") {
    return {
      params,
      status: staleResult ? "stale" : "failed",
      result: staleResult,
      error: { code: latestJob.errorCode ?? "UNKNOWN", message: latestJob.errorMessage ?? "Report gagal diproses." },
    };
  }
  return { params, status: staleResult ? "stale" : "pending", result: staleResult, error: null };
}

