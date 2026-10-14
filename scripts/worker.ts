/**
 * Worker antrean (PRD §11.1): proses terpisah dari siklus request web.
 *   npm run worker
 * Env opsional: WORKER_POLL_MS (default 2000), JOB_LEASE_MS (default 60000).
 * Berhenti dengan Ctrl+C: menyelesaikan job yang sedang berjalan lalu keluar.
 * Bila proses mati mendadak, lease job kedaluwarsa dan job diklaim ulang; report yang sudah dimulai
 * dilanjutkan lewat last-report (bila < 25 menit), bukan dibuat ulang.
 */
import { hostname } from "node:os";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

async function main() {
  const { claimNextJob } = await import("@/lib/jobs/queue");
  const { processReportJob, REPORT_JOB_TYPE } = await import("@/lib/analysis/report-jobs");
  const { processPortJob, PORT_JOB_TYPE } = await import("@/lib/ports/port-jobs");
  const { processExportJob } = await import("@/lib/reports/export-job");
  const { EXPORT_JOB_TYPE } = await import("@/lib/reports/service");

  const workerId = `${hostname()}:${process.pid}:${Math.random().toString(36).slice(2, 8)}`;
  const pollMs = Number(process.env.WORKER_POLL_MS) || 2000;
  const leaseMs = Number(process.env.JOB_LEASE_MS) || 60_000;
  let stopping = false;
  const log = (message: string) => console.log(`[${new Date().toISOString()}] ${message}`);

  const stop = () => {
    if (stopping) process.exit(1);
    stopping = true;
    log("menerima sinyal berhenti; menunggu job berjalan selesai (Ctrl+C lagi untuk paksa)");
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  if (!process.env.GFW_API_ACCESS_TOKEN) log("PERINGATAN: GFW_API_ACCESS_TOKEN belum diisi; job report akan gagal.");
  log(`worker ${workerId} mulai (poll ${pollMs} ms, lease ${leaseMs} ms)`);

  while (!stopping) {
    const job = claimNextJob(workerId, leaseMs, [REPORT_JOB_TYPE, PORT_JOB_TYPE, EXPORT_JOB_TYPE]);
    if (!job) {
      await new Promise((r) => setTimeout(r, pollMs));
      continue;
    }
    log(`klaim job ${job.id} (${job.type}, percobaan ${job.attempts}/${job.maxAttempts})`);
    const ctx = { workerId, leaseMs, log };
    const outcome =
      job.type === PORT_JOB_TYPE
        ? await processPortJob(job, ctx)
        : job.type === EXPORT_JOB_TYPE
          ? await processExportJob(job, ctx)
          : await processReportJob(job, ctx);
    log(`job ${job.id} → ${outcome}`);
  }
  log("worker berhenti");
}

void main();
