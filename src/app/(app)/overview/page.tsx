import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ReportLoader } from "@/components/analysis/ReportLoader";
import { ProvenanceDetails } from "@/components/analysis/ProvenanceDetails";
import { TrendChart, type TrendSeries } from "@/components/charts/TrendChart";
import { FilterBar } from "@/components/filters/FilterBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/Badge";
import { InfoTip } from "@/components/ui/InfoTip";
import { QuickStart } from "@/components/layout/QuickStart";
import { RegionNotice } from "@/components/layout/RegionNotice";
import { GLOSSARY, METRIC_COPY, VESSEL_COUNT_COPY } from "@/lib/copy";
import { Banner } from "@/components/ui/Banner";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { MetricCard, type MetricComparison } from "@/components/ui/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateView } from "@/components/ui/StateView";
import type { Cell, DailyResult } from "@/lib/analysis/aggregate";
import { buildOverview, kpiChange, KPI_DATASETS, type KpiDataset, type Part } from "@/lib/analysis/overview";
import { addDays, defaultFilter, overlapsRecentDelay, parseFilter, todayUtc, type PeriodFilter } from "@/lib/analysis/period";
import { requireUser } from "@/lib/auth/session";
import { FindingPriorityBadge, FindingStatusBadge } from "@/components/findings/FindingBadges";
import { listFindings } from "@/lib/findings/service";
import { formatCount, formatDateRangeUTC, formatDateTimeUTC, formatHours, formatLatLon } from "@/lib/format";
import { listRegions } from "@/lib/regions";

export const metadata: Metadata = { title: "Ringkasan" };

export default function OverviewPage({ searchParams }: PageProps<"/overview">) {
  return (
    <PageContainer>
      <PageHeader
        title="Ringkasan"
        description="Gambaran singkat aktivitas kapal di perairan Indonesia. Ubah wilayah atau tanggal di bawah, lalu tekan Terapkan."
      />
      <Suspense fallback={<StateView state="loading" title="Memuat ringkasan…" />}>
        <OverviewContent searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}

const KPI_META: Record<KpiDataset, { label: string; unit: string; format: "hours" | "count"; color: string; helper: string }> = {
  fishingEffort: { label: METRIC_COPY.fishingEffort.name, unit: "jam", format: "hours", color: "var(--color-data-fishing)", helper: METRIC_COPY.fishingEffort.explain },
  presence: { label: METRIC_COPY.presence.name, unit: "jam", format: "hours", color: "var(--color-data-presence)", helper: METRIC_COPY.presence.explain },
  sar: { label: METRIC_COPY.sar.name, unit: "deteksi", format: "count", color: "var(--color-data-sar)", helper: METRIC_COPY.sar.explain },
};

function mapHref(f: PeriodFilter, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ region: f.regionId, from: f.from, to: f.to, ...extra });
  return `/map?${params.toString()}`;
}

function periodLabel(f: PeriodFilter) {
  return `${formatDateRangeUTC(f.from, f.to)} · ${f.days} hari`;
}

async function OverviewContent({ searchParams }: { searchParams: PageProps<"/overview">["searchParams"] }) {
  await requireUser();
  const sp = await searchParams;
  const regions = listRegions().filter((r) => r.analyzable);
  if (regions.length === 0) {
    return (
      <StateView state="gated" title="Belum ada wilayah tervalidasi">
        Admin perlu mengimpor geometri cakupan (<code>npm run regions:import</code>) sebelum ringkasan dapat dihitung.
      </StateView>
    );
  }

  const { filter, error } = parseFilter(sp, regions.map((r) => r.id));
  const overview = buildOverview(filter);
  if (!overview) return <StateView state="error">Wilayah terpilih tidak memiliki region GFW yang tervalidasi.</StateView>;
  const region = regions.find((r) => r.id === filter.regionId)!;
  const defaults = defaultFilter(regions[0].id);
  const trendParam = typeof sp.trend === "string" ? sp.trend : "fishingEffort";
  const totalParts = KPI_DATASETS.length * 2 + 2;

  return (
    <>
      <QuickStart query={new URLSearchParams({ region: filter.regionId, from: filter.from, to: filter.to }).toString()} />

      <FilterBar
        regions={regions.map((r) => ({ id: r.id, name: r.name }))}
        applied={{ regionId: filter.regionId, from: filter.from, to: filter.to }}
        defaults={{ regionId: defaults.regionId, from: defaults.from, to: defaults.to }}
        maxDate={addDays(todayUtc(), -1)}
      />

      {error ? <Banner tone="warning" title={error} /> : null}

      <AppliedContext regionName={region.name} filter={filter} previous={overview.previous} />
      <RegionNotice region={region} />

      {overlapsRecentDelay(filter) ? (
        <Banner tone="warning" title="Data beberapa hari terakhir mungkin belum lengkap.">
          Data AIS biasanya baru tersedia sekitar 4 hari setelah kejadian, dan data radar sekitar 5 hari.
        </Banner>
      ) : null}

      <ReportLoader pending={overview.pendingParams} failed={overview.failedParams} total={totalParts} />

      <section aria-labelledby="judul-kpi" className="flex flex-col gap-3">
        <h2 id="judul-kpi" className="sr-only">
          Indikator utama
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-4">
          {KPI_DATASETS.map((dataset) => (
            <KpiCard key={dataset} dataset={dataset} current={overview.current[dataset]} prior={overview.prior[dataset]} previous={overview.previous} filter={filter} />
          ))}
          <VesselKpi part={overview.vessels} filter={filter} />
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-4 md:gap-6 xl:grid-cols-12">
        <Card className="min-w-0 xl:col-span-7">
          <CardHeader
            title="Naik-turun aktivitas per hari"
            description="Garis tegas = periode yang dipilih, garis putus-putus = periode sebelumnya."
            info={`Kedua periode sama panjang (${filter.days} hari). Hari tanpa data tampil sebagai celah, bukan nol. ${GLOSSARY.utc}`}
          />
          <TrendChart
            series={KPI_DATASETS.map((d) => trendSeries(d, overview.current[d], overview.prior[d], filter, overview.previous))}
            initialKey={trendParam}
            regionName={region.name}
          />
        </Card>
        <Card className="min-w-0 xl:col-span-5">
          <CardHeader
            title="Lokasi paling ramai penangkapan ikan"
            description="10 kotak peta dengan jam penangkapan ikan tertinggi."
            info={`${GLOSSARY.cell} Ini peringkat aktivitas yang terlihat, bukan peringkat risiko atau pelanggaran.`}
          />
          <HotspotTable part={overview.fishingCells} filter={filter} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-6">
        <Card>
          <CardHeader
            title="Temuan terbaru"
            description="Catatan tim tentang aktivitas yang perlu ditindaklanjuti."
            as="h2"
            actions={
              <Link href="/findings" className="font-medium text-primary underline underline-offset-2">
                Semua temuan
              </Link>
            }
          />
          <RecentFindings />
        </Card>
      </div>

      <p className="text-caption text-ink-muted">
        Data dari{" "}
        <a href="https://globalfishingwatch.org" target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-2">
          Global Fishing Watch
        </a>
        . {GLOSSARY.notViolation}{" "}
        <Link href="/data-status" className="font-medium text-primary underline underline-offset-2">
          Cara membaca data ini
        </Link>
      </p>
    </>
  );
}

function AppliedContext({ regionName, filter, previous }: { regionName: string; filter: PeriodFilter; previous: PeriodFilter }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-button bg-surface-subtle px-4 py-3">
      <span className="text-ink-muted">Menampilkan</span>
      <span className="font-semibold text-ink">{regionName}</span>
      <span className="text-ink-muted">·</span>
      <span className="font-semibold text-ink">{periodLabel(filter)}</span>
      <span className="text-ink-muted">dibanding {formatDateRangeUTC(previous.from, previous.to)}</span>
      <span className="inline-flex items-center">
        <Badge tone="neutral">Kelengkapan belum diketahui</Badge>
        <InfoTip label="Kelengkapan data">
          {GLOSSARY.completeness} {GLOSSARY.utc}
        </InfoTip>
      </span>
    </p>
  );
}

function statusBadge(part: Part) {
  if (part.status === "stale" && part.result) {
    return <Badge tone="warning">Hasil tersimpan · {formatDateTimeUTC(part.result.provenance.fetchedAt)}</Badge>;
  }
  if (part.status === "failed") return <Badge tone="error">Sumber gagal diakses</Badge>;
  return null;
}

function KpiCard({
  dataset,
  current,
  prior,
  previous,
  filter,
}: {
  dataset: KpiDataset;
  current: Part<DailyResult>;
  prior: Part<DailyResult>;
  previous: PeriodFilter;
  filter: PeriodFilter;
}) {
  const meta = KPI_META[dataset];
  const total = current.result?.payload.total ?? null;
  const format = meta.format === "hours" ? formatHours : formatCount;
  const prevLabel = `dari periode sebelumnya (${formatDateRangeUTC(previous.from, previous.to)})`;
  let comparison: MetricComparison | undefined;
  const change = kpiChange(current, prior);
  if (change?.kind === "percent") comparison = { kind: "percent", value: change.value, label: prevLabel };
  else if (change?.kind === "not-computable") comparison = { kind: "not-computable", label: "periode sebelumnya bernilai nol" };
  else if (current.result) {
    comparison = {
      kind: "unavailable",
      label: prior.status === "failed" ? "Periode sebelumnya gagal dimuat." : prior.result ? "Tidak bisa dibandingkan (periode sebelumnya tanpa data)." : "Memuat periode sebelumnya…",
    };
  }

  return (
    <MetricCard
      label={meta.label}
      info={meta.helper}
      value={current.result ? (total === null ? null : format(total)) : null}
      unit={meta.unit}
      period={`${filter.days} hari UTC`}
      loading={current.status === "pending"}
      comparison={comparison}
      unknownText={
        current.status === "failed"
          ? `Data belum bisa diambil (${current.error?.code ?? "galat"}). Kami tidak menampilkannya sebagai nol.`
          : "Tidak ada data untuk periode ini."
      }
      footer={
        <>
          {statusBadge(current)}
          {current.result ? <ProvenanceDetails provenance={current.result.provenance} summary="Sumber data" /> : null}
        </>
      }
    />
  );
}

function VesselKpi({ part, filter }: { part: Overview["vessels"]; filter: PeriodFilter }) {
  const payload = part.result?.payload;
  return (
    <MetricCard
      label={VESSEL_COUNT_COPY.name}
      info={VESSEL_COUNT_COPY.explain}
      value={payload ? formatCount(payload.uniqueVesselIds) : null}
      unit={VESSEL_COUNT_COPY.unit}
      period={`${filter.days} hari UTC`}
      loading={part.status === "pending"}
      unknownText={
        part.status === "failed"
          ? `Data belum bisa diambil (${part.error?.code ?? "galat"}).`
          : "Tidak ada data untuk periode ini."
      }
      footer={
        <>
          {statusBadge(part)}
          {part.result ? <ProvenanceDetails provenance={part.result.provenance} summary="Sumber data" /> : null}
        </>
      }
    />
  );
}

type Overview = NonNullable<ReturnType<typeof buildOverview>>;

function trendSeries(
  dataset: KpiDataset,
  current: Part<DailyResult>,
  prior: Part<DailyResult>,
  filter: PeriodFilter,
  previous: PeriodFilter,
): TrendSeries {
  const meta = KPI_META[dataset];
  const notes: string[] = [];
  const missing = current.result?.payload.daysWithoutRows.length ?? 0;
  if (missing > 0) notes.push(`${missing} hari tidak ada data (tampil sebagai celah, bukan nol).`);
  if (dataset === "sar") notes.push("Naik-turun deteksi radar ikut dipengaruhi jadwal lintasan satelit.");
  if (prior.status === "pending") notes.push("Garis periode sebelumnya sedang dimuat.");
  if (prior.status === "failed") notes.push("Garis periode sebelumnya gagal dimuat.");
  return {
    key: dataset,
    label: meta.label,
    unit: meta.unit,
    valueFormat: meta.format,
    color: meta.color,
    current: current.result?.payload.series ?? null,
    previous: prior.result?.payload.series ?? null,
    currentLabel: formatDateRangeUTC(filter.from, filter.to),
    previousLabel: formatDateRangeUTC(previous.from, previous.to),
    notes,
    state: current.result ? "ready" : current.status === "failed" ? "error" : "loading",
    errorMessage: current.error ? `Data belum bisa diambil (${current.error.code}).` : null,
  };
}

function HotspotTable({ part, filter }: { part: Overview["fishingCells"]; filter: PeriodFilter }) {
  if (part.status === "pending" && !part.result) return <StateView state="loading" title="Memuat lokasi…" className="min-h-[300px]" />;
  if (!part.result) {
    return <StateView state="error">Lokasi belum bisa dimuat ({part.error?.code ?? "galat"}).</StateView>;
  }
  const top: Array<Cell & { rank: number }> = part.result.payload.cells.slice(0, 10).map((c, i) => ({ ...c, rank: i + 1 }));
  return (
    <div className="flex flex-col gap-3">
      <DataTable
        caption="10 lokasi dengan jam penangkapan ikan tertinggi"
        rows={top}
        rowKey={(c) => `${c.lat},${c.lon}`}
        emptyText="Tidak ada aktivitas tercatat pada periode ini."
        columns={[
          { key: "rank", header: "#", align: "right", cell: (c) => c.rank },
          { key: "cell", header: "Lokasi", cell: (c) => <span className="whitespace-nowrap">{formatLatLon(c.lat, c.lon)}</span> },
          { key: "value", header: "Jam", align: "right", cell: (c) => formatHours(c.value) },
          {
            key: "flag",
            header: "Bendera terbanyak",
            cell: (c) => {
              const [flag, value] = c.byFlag[0] ?? [null, 0];
              const share = c.value > 0 ? Math.round((value / c.value) * 100) : 0;
              return (
                <span className="whitespace-nowrap">
                  {flag ?? "Tidak diketahui"} <span className="text-ink-muted">({share}%)</span>
                </span>
              );
            },
          },
          {
            key: "map",
            header: "Peta",
            cell: (c) => (
              <Link
                href={mapHref(filter, { layer: "fishingEffort", cell: `${c.lat},${c.lon}` })}
                className="font-medium whitespace-nowrap text-primary underline underline-offset-2"
              >
                Lihat di peta
                <span className="sr-only"> lokasi {formatLatLon(c.lat, c.lon)}</span>
              </Link>
            ),
          },
        ]}
      />
      <p className="text-caption text-ink-muted">
        Total {formatCount(part.result.payload.cellCount)} kotak peta memiliki aktivitas. Bendera = negara bendera kapal menurut AIS.
      </p>
      {statusBadge(part)}
      <ProvenanceDetails provenance={part.result.provenance} summary="Sumber data" />
    </div>
  );
}

function RecentFindings() {
  const findings = listFindings({ limit: 5 });
  if (findings.length === 0) {
    return (
      <StateView state="empty" title="Belum ada temuan." className="py-6">
        Saat melihat peta atau profil kapal, tekan “Simpan temuan” untuk mencatat hal yang perlu ditindaklanjuti.
      </StateView>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-border">
      {findings.map((f) => (
        <li key={f.id} className="flex flex-col gap-1 py-3 first:pt-0">
          <Link href={`/findings/${f.id}`} className="font-medium break-words text-primary underline underline-offset-2">
            {f.title}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <FindingStatusBadge status={f.status} />
            <FindingPriorityBadge priority={f.priority} />
            <span className="text-caption text-ink-muted">
              {f.createdBy.name} · diperbarui {formatDateTimeUTC(f.updatedAt)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
