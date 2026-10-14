"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { SaveFindingButton } from "@/components/findings/SaveFindingButton";
import { StateView } from "@/components/ui/StateView";
import type { NormalizedEvent } from "@/lib/gfw/schemas";
import { formatDateRangeUTC, formatDateTimeUTC, formatDuration, formatHours, formatLatLon } from "@/lib/format";

type Kind = "fishing" | "encounter" | "loitering" | "port_visit";

type Page = {
  events: NormalizedEvent[];
  total: number | null;
  nextOffset: number | null;
  datasetResolved: string | null;
  fetchedAt: string;
  period: { from: string; to: string; start: string; end: string };
  region: { id: string; name: string };
};

type VesselEventsProps = {
  vesselId: string;
  kinds: Kind[];
  filter: { regionId: string; from: string; to: string };
  canCreate: boolean;
};

const KIND_LABEL: Record<Kind, string> = {
  fishing: "Menangkap ikan",
  encounter: "Bertemu kapal lain",
  loitering: "Berhenti di laut",
  port_visit: "Singgah di pelabuhan",
};

const KIND_CAVEAT: Record<Kind, string> = {
  fishing: "Perkiraan kapan kapal menangkap ikan, dari pola gerak AIS (apparent fishing). Bukan bukti pelanggaran.",
  encounter: "Dua kapal berdekatan cukup lama di laut (encounter). Bukan bukti pindah muatan (transshipment).",
  loitering: "Kapal bergerak sangat lambat atau diam di laut cukup lama (loitering). Tujuannya tidak diketahui.",
  port_visit: "Kapal singgah di pelabuhan, dikenali dari sinyal AIS. Bukan bukti bongkar muat hasil tangkapan.",
};

/**
 * Riwayat kejadian kapal di wilayah tervalidasi (FR-07). Pagination memakai nextOffset GFW
 * (terbukti: null di halaman terakhir, tanpa duplikat). Waktu UTC; durasi dari interval start–end.
 */
export function VesselEvents({ vesselId, kinds, filter, canCreate }: VesselEventsProps) {
  const [kind, setKind] = useState<Kind>(kinds[0]);
  const [pages, setPages] = useState<{ key: string; items: NormalizedEvent[]; last: Page } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const key = `${kind}:${filter.regionId}:${filter.from}:${filter.to}`;

  async function load(offset: number) {
    const params = new URLSearchParams({ kind, region: filter.regionId, from: filter.from, to: filter.to, offset: String(offset) });
    const res = await fetch(`/api/vessels/${vesselId}/events?${params}`);
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
    return body.data as Page;
  }

  useEffect(() => {
    let cancelled = false;
    load(0)
      .then((page) => !cancelled && setPages({ key, items: page.events, last: page }))
      .catch((e: Error) => !cancelled && setFailure({ key, message: e.message }));
    return () => {
      cancelled = true;
    };
    // `key` mewakili kind & filter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  async function loadMore() {
    if (!pages?.last.nextOffset) return;
    setLoadingMore(true);
    try {
      const page = await load(pages.last.nextOffset);
      // Dedup berdasarkan ID kejadian untuk berjaga-jaga (contract check: tidak ada duplikat).
      const seen = new Set(pages.items.map((e) => e.id));
      setPages({ key, items: [...pages.items, ...page.events.filter((e) => !seen.has(e.id))], last: page });
    } catch (e) {
      setFailure({ key, message: (e as Error).message });
    } finally {
      setLoadingMore(false);
    }
  }

  const current = pages?.key === key ? pages : null;
  const error = failure?.key === key ? failure.message : null;

  return (
    <div className="flex flex-col gap-4">
      {kinds.length > 1 ? (
        <div role="group" aria-label="Jenis kejadian" className="flex flex-wrap gap-2">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={k === kind}
              onClick={() => setKind(k)}
              className={cn(
                "h-9 rounded-full border px-3 text-body transition-colors duration-150",
                k === kind ? "border-primary bg-primary-soft font-semibold text-primary" : "border-border-control bg-surface hover:bg-surface-subtle",
              )}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      ) : null}
      <p className="text-caption text-ink-muted">{KIND_CAVEAT[kind]}</p>

      {error && !current ? (
        <StateView state="error">Kejadian belum dapat dimuat dari sumber ({error}).</StateView>
      ) : !current ? (
        <StateView state="loading" title="Memuat kejadian…" />
      ) : current.items.length === 0 ? (
        <StateView state="empty" title={`Tidak ada kejadian ${KIND_LABEL[kind].toLowerCase()} yang tercatat.`}>
          Wilayah {current.last.region.name}, {formatDateRangeUTC(current.last.period.from, current.last.period.to)}.
        </StateView>
      ) : (
        <>
          <DataTable
            caption={`Kejadian ${KIND_LABEL[kind]} kapal`}
            rows={current.items}
            rowKey={(e) => e.id}
            total={current.last.total}
            columns={[
              ...(kind === "port_visit" ? portColumns(current.last.period) : activityColumns(kind, current.last.period)),
              {
                key: "finding",
                header: "Temuan",
                cell: (e) => (
                  <SaveFindingButton
                    canCreate={canCreate}
                    size="compact"
                    label="Simpan"
                    filter={filter}
                    defaultTitle={`${KIND_LABEL[kind]} ${e.vessel.name ?? "kapal"} ${e.start.slice(0, 10)}`}
                    source={{
                      type: "event",
                      eventId: e.id,
                      eventType: e.type,
                      start: e.start,
                      end: e.end,
                      vesselId: e.vessel.id,
                      vesselName: e.vessel.name,
                      lat: e.position?.lat ?? null,
                      lon: e.position?.lon ?? null,
                      portName: e.portVisit?.startAnchorage?.name ?? null,
                      datasetResolved: current.last.datasetResolved,
                      fetchedAt: current.last.fetchedAt,
                    }}
                  />
                ),
              },
            ]}
          />
          <div className="flex flex-wrap items-center gap-3">
            {current.last.nextOffset ? (
              <Button variant="secondary" loading={loadingMore} loadingLabel="Memuat…" onClick={loadMore}>
                Muat kejadian berikutnya
              </Button>
            ) : (
              <span className="text-caption text-ink-muted">Semua kejadian pada periode ini sudah ditampilkan.</span>
            )}
            {error ? <span className="text-caption text-error">Halaman berikutnya gagal dimuat.</span> : null}
          </div>
          <p className="text-caption text-ink-muted">
            Wilayah {current.last.region.name} · kejadian yang overlap periode {formatDateRangeUTC(current.last.period.from, current.last.period.to)} ·
            Global Fishing Watch {current.last.datasetResolved ?? ""} · diambil {formatDateTimeUTC(current.last.fetchedAt)}
          </p>
        </>
      )}
    </div>
  );
}

function OverlapBadges({ e, period }: { e: NormalizedEvent; period: Page["period"] }) {
  const before = e.start < `${period.start}T00:00:00`;
  const after = e.end > `${period.end}T00:00:00`;
  if (!before && !after) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {before ? <Badge tone="info">Dimulai sebelum periode</Badge> : null}
      {after ? <Badge tone="info">Berlanjut setelah periode</Badge> : null}
    </div>
  );
}

function timeColumns(period: Page["period"]): Column<NormalizedEvent>[] {
  return [
    {
      key: "start",
      header: "Mulai – selesai (UTC)",
      cell: (e) => (
        <div className="min-w-[190px]">
          <p className="whitespace-nowrap">{formatDateTimeUTC(e.start)}</p>
          <p className="whitespace-nowrap text-ink-muted">{formatDateTimeUTC(e.end)}</p>
          <OverlapBadges e={e} period={period} />
        </div>
      ),
    },
    { key: "dur", header: "Durasi", align: "right", cell: (e) => formatDuration(e.durationHours) },
  ];
}

function activityColumns(kind: Kind, period: Page["period"]): Column<NormalizedEvent>[] {
  return [
    ...timeColumns(period),
    {
      key: "pos",
      header: "Lokasi representatif",
      cell: (e) => (e.position ? <span className="whitespace-nowrap">{formatLatLon(e.position.lat, e.position.lon)}</span> : "Tidak tersedia"),
    },
    {
      key: "detail",
      header: "Detail",
      cell: (e) => {
        if (kind === "encounter" && e.encounter) {
          const other = e.encounter.otherVessel;
          return (
            <div className="min-w-[200px] text-caption">
              {other ? (
                <p>
                  Dengan{" "}
                  <Link href={`/vessels/${other.id}`} className="font-medium text-primary underline underline-offset-2">
                    {other.name ?? "Nama tidak tersedia"}
                  </Link>{" "}
                  ({other.flag ?? "bendera tidak diketahui"}, MMSI {other.ssvid ?? "—"})
                </p>
              ) : (
                <p>Kapal lain tidak tersedia</p>
              )}
              <p className="text-ink-muted">
                Jarak median {e.encounter.medianDistanceKm ?? "—"} km · kecepatan median {e.encounter.medianSpeedKnots ?? "—"} knot
              </p>
            </div>
          );
        }
        if (kind === "loitering" && e.loitering) {
          return (
            <p className="min-w-[180px] text-caption">
              Total waktu {formatDuration(e.loitering.totalTimeHours)} · rata-rata {formatHours(e.loitering.averageDistanceFromShoreKm)} km dari pantai
            </p>
          );
        }
        if (e.fishing) {
          return (
            <p className="min-w-[180px] text-caption">
              Jarak {formatHours(e.fishing.totalDistanceKm)} km · kecepatan rata-rata {formatHours(e.fishing.averageSpeedKnots)} knot
            </p>
          );
        }
        return "—";
      },
    },
  ];
}

function portColumns(period: Page["period"]): Column<NormalizedEvent>[] {
  return [
    {
      key: "port",
      header: "Pelabuhan (GFW)",
      cell: (e) => {
        const a = e.portVisit?.startAnchorage;
        return (
          <div className="min-w-[160px]">
            <p className="font-medium">{a?.name ?? "Nama tidak tersedia"}</p>
            <p className="font-mono text-caption text-ink-muted">{a?.id ?? "ID tidak tersedia"}</p>
          </div>
        );
      },
    },
    ...timeColumns(period),
    {
      key: "conf",
      header: "Confidence",
      align: "right",
      cell: (e) => e.portVisit?.confidence ?? "—",
    },
    {
      key: "dock",
      header: "Di dermaga",
      cell: (e) => {
        const dock = e.portVisit?.startAnchorage?.atDock;
        return dock === null || dock === undefined ? "Tidak tersedia" : dock ? "Ya" : "Tidak";
      },
    },
    {
      key: "n",
      header: "Anchorage",
      cell: (e) => <span className="font-mono text-caption">{e.portVisit?.startAnchorage?.anchorageId ?? "—"}</span>,
    },
  ];
}

