import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openDatabase, setDbForTesting } from "@/lib/db";
import { createUser } from "@/lib/auth/service";
import { readZip } from "@/lib/gfw/zip";
import { claimNextJob, getJob } from "@/lib/jobs/queue";
import { importEezIndonesia } from "@/lib/regions";

const adapters = vi.hoisted(() => ({ runRegionReport: vi.fn() }));
vi.mock("@/lib/gfw/adapters", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gfw/adapters")>();
  return { ...actual, runRegionReport: adapters.runRegionReport };
});

const { processReportJob, REPORT_JOB_TYPE, getReportResult } = await import("@/lib/analysis/report-jobs");
const { normalizeReportResponse } = await import("@/lib/gfw/adapters");
const { processExportJob } = await import("./export-job");
const { createReport, EXPORT_JOB_TYPE, getReport } = await import("./service");

const ctx = { workerId: "w", leaseMs: 60_000, log: () => {} };

/** Report harian nyata (fixture 11) dengan nama dataset disesuaikan. */
function dailyJson(dataset: string) {
  const f = JSON.parse(readFileSync(path.join(process.cwd(), "fixtures", "gfw", "11-report-fishing-daily-aggregated.json"), "utf8"));
  const [, value] = Object.entries(f.response.body.entries[0] as Record<string, { sample: unknown[] }>)[0];
  return { ...f.response.body, entries: [{ [`${dataset}:v4.0`]: value.sample }] };
}

let userId: string;
beforeEach(async () => {
  setDbForTesting(openDatabase(":memory:"));
  process.env.REPORTS_DIR = mkdtempSync(path.join(tmpdir(), "laporan-"));
  importEezIndonesia(readFileSync(path.join(process.cwd(), "fixtures", "gfw", "region-eez-8492.geojson"), "utf8"), null);
  userId = (await createUser({ email: "a@uji.local", name: "Analis", role: "user", password: "kata-sandi-panjang-1" })).id;
  adapters.runRegionReport.mockReset();
  adapters.runRegionReport.mockImplementation(async (p: { dataset: "fishingEffort" | "presence" | "sar" }) => {
    const name = { fishingEffort: "public-global-fishing-effort", presence: "public-global-presence", sar: "public-global-sar-presence" }[p.dataset];
    return normalizeReportResponse(dailyJson(name), p.dataset, `${name}:v4.0`);
  });
});

function parseCsv(text: string) {
  return text.replace(/^﻿/, "").trim().split("\r\n").map((l) => l.split(","));
}

describe("ekspor laporan", () => {
  it("menunggu snapshot, lalu menulis ZIP berisi data & metadata yang cocok dengan snapshot", async () => {
    const { report } = createReport(
      { idempotencyKey: "kunci-uji-0001", params: { type: "ringkasan_harian", regionId: "eez-idn", from: "2026-09-26", to: "2026-10-02" } },
      userId,
    );
    const now = Date.now();
    // 1) Ekspor pertama: snapshot belum ada → job sumber diantre, ekspor ditunda tanpa menghitung percobaan.
    const exportJob = claimNextJob("w", 60_000, [EXPORT_JOB_TYPE])!;
    expect(await processExportJob(exportJob, ctx)).toBe("queued");
    expect(getJob(exportJob.id)).toMatchObject({ state: "queued", attempts: 0 });
    expect(getReport(report.id)?.status).toBe("antre");

    // 2) Worker memproses 3 report sumber.
    for (let i = 0; i < 3; i++) {
      const j = claimNextJob("w", 60_000, [REPORT_JOB_TYPE])!;
      expect(await processReportJob(j, ctx)).toBe("succeeded");
    }

    // 3) Ekspor diklaim lagi setelah jeda → selesai.
    const again = claimNextJob("w", 60_000, [EXPORT_JOB_TYPE], new Date(now + 20_000))!;
    expect(await processExportJob(again, ctx)).toBe("succeeded");
    const done = getReport(report.id)!;
    expect(done).toMatchObject({ status: "siap", rowCount: 7 });
    expect(done.snapshotRefs).toHaveLength(3);

    const files = readZip(readFileSync(path.join(process.env.REPORTS_DIR!, `${report.id}.zip`)));
    const data = parseCsv(files.get("data.csv")!.toString("utf8"));
    expect(data[0]).toEqual(["tanggal_utc", "jam_apparent_fishing", "jam_keberadaan_ais", "deteksi_radar"]);
    const sum = data.slice(1).reduce((a, r) => a + (r[1] ? Number(r[1]) : 0), 0);
    const snapshot = getReportResult(done.snapshotRefs[0]) as { payload: { total: number } };
    expect(sum).toBeCloseTo(snapshot.payload.total, 3);
    // SAR dari fixture fishing tidak punya field detections → kosong, bukan 0.
    expect(data.slice(1).every((r) => r[3] === "")).toBe(true);

    const meta = files.get("metadata.csv")!.toString("utf8");
    expect(meta).toContain("fishing_dataset_dilayani,public-global-fishing-effort:v4.0");
    expect(meta).toContain("zona_waktu,Semua tanggal & waktu dalam UTC.");
    expect(meta).toContain("Powered by Global Fishing Watch");
  });

  it("idempotency key yang sama tidak membuat laporan ganda; rentang tidak valid ditolak", () => {
    const input = { idempotencyKey: "kunci-uji-0002", params: { type: "ringkasan_harian", regionId: "eez-idn", from: "2026-09-26", to: "2026-10-02" } };
    const a = createReport(input, userId);
    const b = createReport(input, userId);
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(b.report.id).toBe(a.report.id);
    expect(() =>
      createReport({ idempotencyKey: "kunci-uji-0003", params: { type: "kunjungan_pelabuhan", regionId: "eez-idn", from: "2026-08-01", to: "2026-09-30" } }, userId),
    ).toThrow(/31 hari/);
  });
});
