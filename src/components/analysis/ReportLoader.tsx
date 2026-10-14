"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";

/** Parameter job yang diteruskan apa adanya ke POST /api/analysis/jobs (report 4Wings atau kunjungan pelabuhan). */
type ReportParams = Record<string, string>;

type ReportLoaderProps = {
  /** Bagian yang belum fresh → diantre otomatis (dedup di server). */
  pending: ReportParams[];
  /** Bagian yang job terakhirnya gagal → hanya diantre lewat tombol "Coba lagi". */
  failed: ReportParams[];
  total: number;
};

type JobInfo = { state: string; error: { code: string; message: string } | null };

const POLL_MS = 3000;
/** Bila antrean tidak bergerak selama ini, kemungkinan worker belum berjalan. */
const STALL_HINT_MS = 20_000;

async function enqueue(params: ReportParams): Promise<{ jobId: string | null; fresh: boolean; error: string | null }> {
  const res = await fetch("/api/analysis/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) return { jobId: null, fresh: false, error: body?.error?.message ?? `Gagal mengantre (${res.status}).` };
  return body.data.status === "fresh" ? { jobId: null, fresh: true, error: null } : { jobId: body.data.jobId, fresh: false, error: null };
}

/**
 * Mengantre bagian yang belum siap lalu memantau status job. Saat ada job selesai, halaman
 * di-refresh agar server merender ulang dari snapshot tersimpan (tanpa memanggil GFW dari browser).
 */
export function ReportLoader({ pending, failed, total }: ReportLoaderProps) {
  const router = useRouter();
  const [jobs, setJobs] = useState<Record<string, JobInfo>>({});
  const [stalled, setStalled] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const key = JSON.stringify(pending);
  const lastProgress = useRef(0);

  useEffect(() => {
    if (pending.length === 0) return;
    let cancelled = false;
    lastProgress.current = Date.now();

    (async () => {
      const ids: string[] = [];
      let freshFound = false;
      for (const params of pending) {
        const out = await enqueue(params);
        if (cancelled) return;
        if (out.error) setRequestError(out.error);
        if (out.fresh) freshFound = true;
        if (out.jobId) ids.push(out.jobId);
      }
      if (freshFound) {
        router.refresh();
        return;
      }
      let finished = new Set<string>();
      while (!cancelled && ids.length > 0) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        if (cancelled) return;
        const states = await Promise.all(
          ids.map(async (id) => {
            const res = await fetch(`/api/analysis/jobs/${id}`, { cache: "no-store" });
            const body = await res.json().catch(() => null);
            return [id, { state: body?.data?.state ?? "unknown", error: body?.data?.error ?? null }] as const;
          }),
        );
        if (cancelled) return;
        setJobs(Object.fromEntries(states));
        const done = new Set(states.filter(([, s]) => s.state === "succeeded" || s.state === "failed").map(([id]) => id));
        const running = states.some(([, s]) => s.state === "running");
        if (done.size > finished.size || running) lastProgress.current = Date.now();
        setStalled(Date.now() - lastProgress.current > STALL_HINT_MS);
        if (done.size > finished.size) {
          finished = done;
          router.refresh();
        }
        if (done.size === ids.length) return;
      }
    })().catch(() => setRequestError("Status antrean tidak dapat diperiksa. Muat ulang halaman."));

    return () => {
      cancelled = true;
    };
    // `key` mewakili isi `pending`; router stabil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  async function retryFailed() {
    setRetrying(true);
    for (const params of failed) await enqueue(params);
    setRetrying(false);
    router.refresh();
  }

  const ready = total - pending.length - failed.length;

  const running = Object.values(jobs).some((j) => j.state === "running");
  if (pending.length === 0 && failed.length === 0) return null;

  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      {pending.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-button border border-info-border bg-info-bg px-4 py-3 text-info" role="status">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          <p className="text-ink">
            <span className="font-semibold">Sedang mengambil data dari Global Fishing Watch</span> · {ready} dari {total} bagian siap{running ? "" : ", menunggu giliran"}.
            Biasanya selesai dalam 1–2 menit; halaman akan diperbarui sendiri.
          </p>
        </div>
      ) : null}
      {stalled ? (
        <Banner tone="warning" title="Pengambilan data belum berjalan.">
          Proses pengambil data (worker) sepertinya belum dinyalakan. Admin: jalankan <code>npm run worker</code> di server.
        </Banner>
      ) : null}
      {requestError ? <Banner tone="error" title={requestError} /> : null}
      {failed.length > 0 ? (
        <Banner
          tone="error"
          title={`${failed.length} bagian data gagal diambil.`}
          action={
            <Button
              variant="secondary"
              size="compact"
              icon={<RotateCcw className="size-4" aria-hidden />}
              loading={retrying}
              loadingLabel="Mengantre…"
              onClick={retryFailed}
            >
              Coba lagi
            </Button>
          }
        >
          Bagian yang gagal ditandai pada kartu terkait; nilainya tidak ditampilkan sebagai nol.
        </Banner>
      ) : null}
    </div>
  );
}
