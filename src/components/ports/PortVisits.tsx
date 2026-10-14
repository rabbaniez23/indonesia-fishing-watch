"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { StateView } from "@/components/ui/StateView";
import type { NormalizedEvent } from "@/lib/gfw/schemas";
import { formatDateRangeUTC, formatDateTimeUTC, formatDuration } from "@/lib/format";

type Page = {
  events: NormalizedEvent[];
  total: number | null;
  nextOffset: number | null;
  datasetResolved: string | null;
  fetchedAt: string;
  region: { id: string; name: string };
  period: { from: string; to: string };
};

/** Daftar kunjungan ke satu pelabuhan (dimulai dalam periode), pagination nextOffset. */
export function PortVisits({ portId, filter }: { portId: string; filter: { regionId: string; from: string; to: string } }) {
  const key = `${portId}:${filter.regionId}:${filter.from}:${filter.to}`;
  const [state, setState] = useState<{ key: string; items: NormalizedEvent[]; last: Page } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  async function load(offset: number) {
    const params = new URLSearchParams({ region: filter.regionId, from: filter.from, to: filter.to, offset: String(offset) });
    const res = await fetch(`/api/ports/${encodeURIComponent(portId)}/visits?${params}`);
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
    return body.data as Page;
  }

  useEffect(() => {
    let cancelled = false;
    load(0)
      .then((page) => !cancelled && setState({ key, items: page.events, last: page }))
      .catch((e: Error) => !cancelled && setFailure({ key, message: e.message }));
    return () => {
      cancelled = true;
    };
    // `key` mewakili portId & filter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = state?.key === key ? state : null;
  const error = failure?.key === key ? failure.message : null;

  async function loadMore() {
    if (!current?.last.nextOffset) return;
    setLoadingMore(true);
    try {
      const page = await load(current.last.nextOffset);
      const seen = new Set(current.items.map((e) => e.id));
      setState({ key, items: [...current.items, ...page.events.filter((e) => !seen.has(e.id))], last: page });
    } catch (e) {
      setFailure({ key, message: (e as Error).message });
    } finally {
      setLoadingMore(false);
    }
  }

  if (error && !current) return <StateView state="error">Kunjungan belum dapat dimuat dari sumber ({error}).</StateView>;
  if (!current) return <StateView state="loading" title="Memuat kunjungan…" />;
  if (current.items.length === 0) {
    return (
      <StateView state="empty" title="Tidak ada kunjungan yang dimulai pada periode ini.">
        {current.last.region.name}, {formatDateRangeUTC(current.last.period.from, current.last.period.to)}.
      </StateView>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <DataTable
        caption="Kunjungan ke pelabuhan"
        rows={current.items}
        rowKey={(e) => e.id}
        total={current.last.total}
        columns={[
          {
            key: "vessel",
            header: "Kapal",
            cell: (e) => (
              <div className="min-w-[170px]">
                <Link href={`/vessels/${e.vessel.id}`} className="font-medium text-primary underline underline-offset-2">
                  {e.vessel.name ?? "Nama tidak tersedia"}
                </Link>
                <p className="text-caption text-ink-muted">
                  {e.vessel.flag ?? "Bendera tidak diketahui"} · MMSI <span className="font-mono">{e.vessel.ssvid ?? "—"}</span>
                  {e.vessel.type ? ` · ${e.vessel.type}` : ""}
                </p>
              </div>
            ),
          },
          {
            key: "time",
            header: "Mulai – selesai (UTC)",
            cell: (e) => (
              <div className="min-w-[180px]">
                <p className="whitespace-nowrap">{formatDateTimeUTC(e.start)}</p>
                <p className="whitespace-nowrap text-ink-muted">{formatDateTimeUTC(e.end)}</p>
              </div>
            ),
          },
          { key: "dur", header: "Durasi", align: "right", cell: (e) => formatDuration(e.durationHours) },
          { key: "conf", header: "Confidence", align: "right", cell: (e) => e.portVisit?.confidence ?? "—" },
          {
            key: "dock",
            header: "Di dermaga",
            cell: (e) => {
              const d = e.portVisit?.startAnchorage?.atDock;
              return d === null || d === undefined ? "Tidak tersedia" : d ? "Ya" : "Tidak";
            },
          },
        ]}
      />
      {current.last.nextOffset ? (
        <Button variant="secondary" className="self-start" loading={loadingMore} loadingLabel="Memuat…" onClick={loadMore}>
          Muat kunjungan berikutnya
        </Button>
      ) : (
        <p className="text-caption text-ink-muted">Semua kunjungan pada periode ini sudah ditampilkan.</p>
      )}
      <p className="text-caption text-ink-muted">
        Sumber: Global Fishing Watch · {current.last.datasetResolved ?? "versi belum diketahui"} · diambil {formatDateTimeUTC(current.last.fetchedAt)}.
        Kunjungan teramati dari AIS; bukan bukti bongkar hasil tangkapan.
      </p>
    </div>
  );
}
