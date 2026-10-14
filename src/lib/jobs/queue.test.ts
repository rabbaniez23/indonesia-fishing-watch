import { beforeEach, describe, expect, it } from "vitest";
import { openDatabase, setDbForTesting } from "@/lib/db";
import { acquireLock, getLock, releaseLock, setLockMeta } from "./locks";
import { claimNextJob, completeJob, enqueueJob, getJob, retryOrFailJob } from "./queue";

beforeEach(() => setDbForTesting(openDatabase(":memory:")));

describe("antrean job", () => {
  it("dedup: job aktif dengan key sama dipakai ulang", () => {
    const a = enqueueJob({ type: "t", dedupKey: "k", params: { x: 1 } });
    const b = enqueueJob({ type: "t", dedupKey: "k", params: { x: 1 } });
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(b.job.id).toBe(a.job.id);
  });

  it("klaim hanya sekali; lease kedaluwarsa → bisa diklaim ulang worker lain", () => {
    const { job } = enqueueJob({ type: "t", dedupKey: "k", params: {} });
    const t0 = new Date();
    const claimed = claimNextJob("w1", 1000, ["t"], t0);
    expect(claimed?.id).toBe(job.id);
    expect(claimNextJob("w2", 1000, ["t"], t0)).toBeNull();
    const reclaimed = claimNextJob("w2", 1000, ["t"], new Date(t0.getTime() + 5000));
    expect(reclaimed?.id).toBe(job.id);
    expect(reclaimed?.attempts).toBe(2);
    expect(reclaimed?.leaseOwner).toBe("w2");
  });

  it("worker yang kehilangan lease tidak dapat menyelesaikan job", () => {
    const { job } = enqueueJob({ type: "t", dedupKey: "k", params: {} });
    const t0 = new Date();
    claimNextJob("w1", 1000, ["t"], t0);
    claimNextJob("w2", 1000, ["t"], new Date(t0.getTime() + 5000));
    completeJob(job.id, "w1", "hasil-w1");
    expect(getJob(job.id)?.state).toBe("running");
    completeJob(job.id, "w2", "hasil-w2");
    expect(getJob(job.id)).toMatchObject({ state: "succeeded", resultRef: "hasil-w2" });
  });

  it("retry dengan backoff lalu gagal permanen setelah batas percobaan", () => {
    const { job } = enqueueJob({ type: "t", dedupKey: "k", params: {}, maxAttempts: 2 });
    claimNextJob("w", 1000, ["t"]);
    expect(retryOrFailJob(job.id, "w", { code: "NETWORK", message: "x", retryable: true, delayMs: 0 })).toBe("queued");
    claimNextJob("w", 1000, ["t"]);
    expect(retryOrFailJob(job.id, "w", { code: "NETWORK", message: "x", retryable: true, delayMs: 0 })).toBe("failed");
    expect(getJob(job.id)).toMatchObject({ state: "failed", errorCode: "NETWORK" });
  });

  it("error non-retryable langsung gagal; penundaan tanpa hitung attempt", () => {
    const a = enqueueJob({ type: "t", dedupKey: "a", params: {} }).job;
    claimNextJob("w", 1000, ["t"]);
    expect(retryOrFailJob(a.id, "w", { code: "FORBIDDEN", message: "x", retryable: false })).toBe("failed");

    const b = enqueueJob({ type: "t", dedupKey: "b", params: {} }).job;
    claimNextJob("w", 1000, ["t"]);
    retryOrFailJob(b.id, "w", { code: "LOCK_BUSY", message: "x", retryable: true, delayMs: 0 }, false);
    expect(getJob(b.id)).toMatchObject({ state: "queued", attempts: 0 });
  });

  it("job tertunda (run_after di masa depan) belum bisa diklaim", () => {
    const { job } = enqueueJob({ type: "t", dedupKey: "k", params: {} });
    claimNextJob("w", 1000, ["t"]);
    retryOrFailJob(job.id, "w", { code: "RATE_LIMITED", message: "x", retryable: true, delayMs: 60_000 });
    expect(claimNextJob("w", 1000, ["t"])).toBeNull();
  });
});

describe("lock", () => {
  it("eksklusif selama lease; meta bertahan setelah dilepas dan diambil alih", () => {
    const t0 = new Date();
    expect(acquireLock("gfw-report", "w1", 1000, t0)).toBe(true);
    expect(acquireLock("gfw-report", "w2", 1000, t0)).toBe(false);
    setLockMeta("gfw-report", "w1", { jobId: "j1" });
    releaseLock("gfw-report", "w1");
    expect(acquireLock("gfw-report", "w2", 1000)).toBe(true);
    expect(getLock("gfw-report")).toMatchObject({ owner: "w2", meta: { jobId: "j1" } });
  });

  it("lease kedaluwarsa (worker mati) dapat diambil alih", () => {
    const t0 = new Date();
    acquireLock("gfw-report", "w1", 1000, t0);
    expect(acquireLock("gfw-report", "w2", 1000, new Date(t0.getTime() + 2000))).toBe(true);
  });
});

describe("transaksi bersarang", () => {
  it("SAVEPOINT: error di dalam hanya membatalkan bagian dalam; error di luar membatalkan semuanya", async () => {
    const { getDb, transaction } = await import("@/lib/db");
    const db = getDb();
    db.exec("CREATE TABLE t (v TEXT)");
    transaction(db, () => {
      db.prepare("INSERT INTO t VALUES ('luar')").run();
      expect(() =>
        transaction(db, () => {
          db.prepare("INSERT INTO t VALUES ('dalam')").run();
          throw new Error("gagal dalam");
        }),
      ).toThrow("gagal dalam");
    });
    expect((db.prepare("SELECT v FROM t").all() as Array<{ v: string }>).map((r) => r.v)).toEqual(["luar"]);
    expect(() =>
      transaction(db, () => {
        db.prepare("INSERT INTO t VALUES ('x')").run();
        transaction(db, () => db.prepare("INSERT INTO t VALUES ('y')").run());
        throw new Error("gagal luar");
      }),
    ).toThrow("gagal luar");
    expect((db.prepare("SELECT COUNT(*) AS n FROM t").get() as { n: number }).n).toBe(1);
    expect(db.isTransaction).toBe(false);
  });
});
