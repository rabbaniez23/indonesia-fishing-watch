import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Anchor, ChevronRight } from "lucide-react";
import { FilterBar } from "@/components/filters/FilterBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { PortVisits } from "@/components/ports/PortVisits";
import { Card, CardHeader } from "@/components/ui/Card";
import { StateView } from "@/components/ui/StateView";
import { addDays, defaultFilter, parseFilter, todayUtc } from "@/lib/analysis/period";
import { requireUser } from "@/lib/auth/session";
import { formatCount, formatDateRangeUTC, formatDuration } from "@/lib/format";
import { isValidPortId } from "@/lib/ports/ids";
import { loadPortPart, PORT_MAX_DAYS } from "@/lib/ports/port-jobs";
import { listRegions } from "@/lib/regions";

export const metadata: Metadata = { title: "Detail pelabuhan" };

export default function PortDetailPage({ params, searchParams }: PageProps<"/ports/[portId]">) {
  return (
    <PageContainer>
      <Suspense fallback={<StateView state="loading" title="Memuat detail pelabuhan…" />}>
        <Detail params={params} searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}

async function Detail({ params, searchParams }: { params: PageProps<"/ports/[portId]">["params"]; searchParams: PageProps<"/ports/[portId]">["searchParams"] }) {
  await requireUser();
  const { portId: raw } = await params;
  const portId = decodeURIComponent(raw);
  if (!isValidPortId(portId)) return <StateView state="error" title="ID pelabuhan tidak valid." />;
  const sp = await searchParams;
  const regions = listRegions().filter((r) => r.analyzable);
  if (regions.length === 0) return <StateView state="gated" title="Belum ada wilayah tervalidasi" />;
  const { filter } = parseFilter(sp, regions.map((r) => r.id), new Date(), PORT_MAX_DAYS);
  const defaults = defaultFilter(regions[0].id);
  // Ringkasan dari agregasi tersimpan (bila sudah ada untuk filter yang sama); tidak memicu job baru.
  const part = loadPortPart({ type: "port_visits", regionId: filter.regionId, start: filter.start, end: filter.end });
  const summary = part.result?.payload.ports.find((p) => p.portId === portId) ?? null;
  const backQuery = new URLSearchParams({ region: filter.regionId, from: filter.from, to: filter.to }).toString();

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-caption text-ink-muted">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href={`/ports?${backQuery}`} className="text-primary underline underline-offset-2">
              Kunjungan pelabuhan
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight className="size-3.5" />
          </li>
          <li aria-current="page">{summary?.name ?? portId}</li>
        </ol>
      </nav>
      <header className="flex items-start gap-3">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-button bg-primary-soft text-primary" aria-hidden>
          <Anchor className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[24px] leading-[32px] font-semibold break-words sm:text-page-title">{summary?.name ?? "Nama tidak tersedia"}</h1>
          <p className="mt-1 text-ink-muted">
            ID pelabuhan GFW <span className="font-mono text-ink">{portId}</span>
            {summary?.flag ? ` · negara ${summary.flag}` : ""} · referensi dari kunjungan teramati
          </p>
        </div>
      </header>

      {summary ? (
        <dl className="grid grid-cols-2 gap-4 glass rounded-card p-4 md:grid-cols-5">
          {[
            ["Kunjungan", formatCount(summary.visits)],
            ["ID kapal", formatCount(summary.vessels)],
            ["Durasi median", formatDuration(summary.medianDurationHours)],
            ["Anchorage", formatCount(summary.anchorages)],
            ["Di dermaga", summary.atDockShare === null ? "Tidak tersedia" : `${Math.round(summary.atDockShare * 100)}%`],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-caption text-ink-muted">{label}</dt>
              <dd className="tabular text-section-title font-semibold">{value}</dd>
            </div>
          ))}
          <p className="col-span-2 text-caption text-ink-muted md:col-span-5">
            Ringkasan {formatDateRangeUTC(filter.from, filter.to)} dari agregasi tersimpan. Bendera kapal terbanyak:{" "}
            {summary.topVesselFlags.map(([f, n]) => `${f ?? "tidak diketahui"} (${formatCount(n)})`).join(", ")}.
          </p>
        </dl>
      ) : null}

      <Card>
        <CardHeader as="h2" title="Periode" description={`Kunjungan yang dimulai dalam periode (maks. ${PORT_MAX_DAYS} hari).`} />
        <FilterBar
          regions={regions.map((r) => ({ id: r.id, name: r.name }))}
          applied={{ regionId: filter.regionId, from: filter.from, to: filter.to }}
          defaults={{ regionId: defaults.regionId, from: defaults.from, to: defaults.to }}
          maxDate={addDays(todayUtc(), -1)}
          maxDays={PORT_MAX_DAYS}
        />
      </Card>

      <Card>
        <CardHeader as="h2" title="Daftar kunjungan" />
        <PortVisits portId={portId} filter={{ regionId: filter.regionId, from: filter.from, to: filter.to }} />
      </Card>
    </>
  );
}
