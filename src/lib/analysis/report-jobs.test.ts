import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, openDatabase, setDbForTesting } from "@/lib/db";
import { GfwError } from "@/lib/gfw/http";
import { claimNextJob, getJob, markUpstreamStarted } from "@/lib/jobs/queue";
import { acquireLock, getLock, releaseLock, setLockMeta } from "@/lib/jobs/locks";
import { importEezIndonesia } from "@/lib/regions";

const adapters = vi.hoisted(() => ({ runRegionReport: vi.fn(), fetchLastReport: vi.fn() }));
vi.mock("@/lib/gfw/adapters", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gfw/adapters")>();
  return { ...actual, runRegionReport: adapters.runRegionReport, fetchLastReport: adapters.fetchLastReport };
});

const { GFW_REPORT_LOCK, getReportResult, processReportJob, requestReport } = await import("./report-jobs");
const { buildReportQuery, normalizeReportResponse } = await import("@/lib/gfw/adapters");

const PARAMS = { dataset: "fishingEffort", kind: "daily", regionId: "eez-idn", start: "2026-09-26", end: "2026-10-03" } as const;
const ctx = { workerId: "w1", leaseMs: 60_000, log: () => {}, lastReportPollMs: 1, lastReportMaxPolls: 3 };

/** Respons report harian nyata (fixture 11) dalam bentuk yang dikirim GFW. */
function dailyJson() {
  const f = JSON.parse(readFileSync(path.join(process.cwd(), "fixtures", "gfw", "11-report-fishing-daily-aggregated.json"), "utf8"));
  const [key, value] = Object.entries(f.response.body.entries[0] as Record<string, { sample: unknown[] }>)[0];
  return { ...f.response.body, entries: [{ [key]: value.sample }] };
}

beforeEach(() => {
  setDbForTesting(openDatabase(":memory:"));
  importEezIndonesia(readFileSync(path.join(process.cwd(), "fixtures", "gfw", "region-eez-8492.geojson"), "utf8"), null);
  adapters.runRegionReport.mockReset();
  adapters.fetchLastReport.mockReset();
});

function enqueueAndClaim() {
  const outcome = requestReport(PARAMS, null);
  if (outcome.status === "fresh") throw new Error("tidak diharapkan");
  return claimNextJob("w1", 60_000, ["gfw_report"])!;
}

describe("processReportJob", () => {
  it("sukses: menyimpan snapshot + provenance, lalu permintaan berikutnya memakai hasil fresh", async () => {
    adapters.runRegionReport.mockImplementation(async () => normalizeReportResponse(dailyJson(), "fishingEffort", "public-global-fishing-effort:v4.0"));
    const job = enqueueAndClaim();
    expect(await processReportJob(job, ctx)).toBe("succeeded");
    expect(adapters.runRegionReport).toHaveBeenCalledTimes(1);

    const done = getJob(job.id)!;
    expect(done.state).toBe("succeeded");
    const result = getReportResult(done.resultRef!) as Awaited<ReturnType<typeof getReportResult>> & { payload: { kind: string } };
    expect(result?.payload.kind).toBe("daily");
    expect(result?.provenance).toMatchObject({
      datasetResolved: "public-global-fishing-effort:v4.0",
      completeness: "unknown",
      recoveredViaLastReport: false,
    });
    expect(result?.provenance.warnings.join(" ")).toMatch(/kelengkapan belum diketahui/);

    const again = requestReport(PARAMS, null);
    expect(again.status).toBe("fresh");
    expect(getLock(GFW_REPORT_LOCK)!.leaseUntil < new Date().toISOString()).toBe(true);
  });

  it("crash setelah report dimulai: klaim ulang memakai last-report, tidak membuat report baru", async () => {
    const job = enqueueAndClaim();
    // Simulasi worker lama: lock + jejak report dicatat, lalu proses mati.
    acquireLock(GFW_REPORT_LOCK, "w-lama", 60_000);
    const { createHash } = await import("node:crypto");
    const query = buildReportQuery({ dataset: "fishingEffort", area: { region: { dataset: "public-eez-areas", id: 8492 } }, start: PARAMS.start, end: PARAMS.end, temporalResolution: "DAILY", spatialAggregation: true, groupBy: "FLAG" });
    const hash = createHash("sha256").update(JSON.stringify(query)).digest("hex");
    setLockMeta(GFW_REPORT_LOCK, "w-lama", { jobId: job.id, requestHash: hash, startedAt: new Date().toISOString() });
    markUpstreamStarted(job.id, hash);
    releaseLock(GFW_REPORT_LOCK, "w-lama");

    adapters.fetchLastReport
      .mockResolvedValueOnce({ state: "running", uri: null })
      .mockResolvedValueOnce({ state: "finished", json: dailyJson(), xDatasets: "public-global-fishing-effort:v4.0" });

    expect(await processReportJob(job, ctx)).toBe("succeeded");
    expect(adapters.runRegionReport).not.toHaveBeenCalled();
    expect(adapters.fetchLastReport).toHaveBeenCalledTimes(2);
    const result = getReportResult(getJob(job.id)!.resultRef!, false);
    expect(result?.provenance.recoveredViaLastReport).toBe(true);
  });

  it("last-report milik report lain (dataset berbeda) → ditolak, jejak dihapus, job diantre ulang", async () => {
    adapters.runRegionReport.mockRejectedValue(new GfwError("REPORT_TIMEOUT", "timeout", 524));
    const otherDataset = JSON.parse(JSON.stringify(dailyJson()).replaceAll("public-global-fishing-effort", "public-global-presence"));
    adapters.fetchLastReport.mockResolvedValue({ state: "finished", json: otherDataset, xDatasets: "public-global-presence:v4.0" });
    const job = enqueueAndClaim();
    expect(await processReportJob(job, ctx)).toBe("queued");
    expect(getJob(job.id)).toMatchObject({ state: "queued", upstreamStartedAt: null });
    expect(getJob(job.id)!.errorMessage).toMatch(/tidak cocok/);
  });

  it("524 dari gateway → dipulihkan lewat last-report", async () => {
    adapters.runRegionReport.mockRejectedValue(new GfwError("REPORT_TIMEOUT", "timeout", 524));
    adapters.fetchLastReport.mockResolvedValue({ state: "finished", json: dailyJson(), xDatasets: undefined });
    const job = enqueueAndClaim();
    expect(await processReportJob(job, ctx)).toBe("succeeded");
    expect(adapters.runRegionReport).toHaveBeenCalledTimes(1);
  });

  it("lock dipegang worker lain → job ditunda tanpa memanggil GFW dan tanpa menghitung percobaan", async () => {
    acquireLock(GFW_REPORT_LOCK, "w-lain", 60_000);
    const job = enqueueAndClaim();
    expect(await processReportJob(job, ctx)).toBe("queued");
    expect(adapters.runRegionReport).not.toHaveBeenCalled();
    expect(getJob(job.id)).toMatchObject({ state: "queued", attempts: 0, errorCode: "LOCK_BUSY" });
  });

  it("422/403 dari GFW → gagal permanen (tidak di-retry)", async () => {
    adapters.runRegionReport.mockRejectedValue(new GfwError("INVALID_REQUEST", "ditolak", 422));
    const job = enqueueAndClaim();
    expect(await processReportJob(job, ctx)).toBe("failed");
    expect(getJob(job.id)).toMatchObject({ state: "failed", errorCode: "INVALID_REQUEST" });
  });

  it("gangguan jaringan → antre ulang dengan backoff", async () => {
    adapters.runRegionReport.mockRejectedValue(new GfwError("NETWORK", "putus", null, true));
    const job = enqueueAndClaim();
    expect(await processReportJob(job, ctx)).toBe("queued");
    expect(getJob(job.id)!.runAfter > new Date().toISOString()).toBe(true);
  });

  it("parameter tidak valid ditolak sebelum masuk antrean", () => {
    expect(() => requestReport({ ...PARAMS, start: "2026-10-03", end: "2026-09-26" }, null)).toThrow();
    expect(() => requestReport({ ...PARAMS, start: "2026-01-01", end: "2026-06-01" }, null)).toThrow(/90 hari/);
    expect(() => requestReport({ ...PARAMS, regionId: "wpp-711" }, null)).toThrow(/tidak tervalidasi/);
    expect((getDb().prepare("SELECT COUNT(*) AS n FROM jobs").get() as { n: number }).n).toBe(0);
  });
});
