import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { METRIC_COPY } from "@/lib/copy";
import { CompareForm } from "@/components/analysis/CompareForm";
import { RegionNotice } from "@/components/layout/RegionNotice";
import { ProvenanceDetails } from "@/components/analysis/ProvenanceDetails";
import { ReportLoader } from "@/components/analysis/ReportLoader";
import { EventsSection, FleetSection, HotspotStats, TrendStats, WppRanking, type WppRow } from "@/components/analysis/StatsSections";
import { TrendChart, type TrendSeries } from "@/components/charts/TrendChart";
import { FilterBar } from "@/components/filters/FilterBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { MetricCard, type MetricComparison } from "@/components/ui/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateView } from "@/components/ui/StateView";
import type { CellsResult, DailyResult, VesselsResult } from "@/lib/analysis/aggregate";
import { loadEventSummary } from "@/lib/analysis/event-summary";
import { compareCells, comparisonPeriod } from "@/lib/analysis/compare";
import { changePercent } from "@/lib/analysis/metrics";
import { loadPart, type Part } from "@/lib/analysis/parts";
import { addDays, defaultFilter, parseFilter, todayUtc, type PeriodFilter } from "@/lib/analysis/period";
import { requireUser } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { formatCount, formatDateRangeUTC, formatHours, formatLatLon, formatPercent } from "@/lib/format";
import { isMapLayerKey, MAP_LAYER_KEYS, MAP_LAYERS, type MapLayerKey } from "@/lib/map/layers";
import { listRegions, regionArea, regionAreaKm2, type RegionSummary } from "@/lib/regions";

export const metadata: Metadata = { title: "Analisis" };

type Tab = "tren" | "kapal" | "hotspot" | "wpp" | "kejadian" | "perbandingan";
const TABS: Array<[Tab, string]> = [
  ["tren", "Naik-turun"],
  ["kapal", "Kapal & alat tangkap"],
  ["hotspot", "Lokasi teramai"],
  ["wpp", "Antar-WPP"],
  ["kejadian", "Kejadian di laut"],
  ["perbandingan", "Bandingkan"],
];
const isTab = (v: unknown): v is Tab => typeof v === "string" && TABS.some(([k]) => k === v);

export default function AnalysisPage({ searchParams }: PageProps<"/analysis">) {
  return (
    <PageContainer>
      <PageHeader
        title="Analisis"
        description="Statistik aktivitas di laut Indonesia: naik-turun harian, armada kapal, lokasi teramai, perbandingan antar-WPP, dan kejadian di laut."
      />
      <Suspense fallback={<StateView state="loading" title="Memuat analisis…" />}>
        <Analysis searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}

const fmt = (layer: MapLayerKey, v: number | null) => (MAP_LAYERS[layer].format === "hours" ? formatHours(v) : formatCount(v));

async function Analysis({ searchParams }: { searchParams: PageProps<"/analysis">["searchParams"] }) {
  await requireUser();
  const sp = await searchParams;
  const regions = listRegions().filter((r) => r.analyzable);
  if (regions.length === 0) return <StateView state="gated" title="Belum ada wilayah tervalidasi" />;
  const { filter, error } = parseFilter(sp, regions.map((r) => r.id));
  const region = regions.find((r) => r.id === filter.regionId)!;
  const tab: Tab = isTab(sp.tab) ? sp.tab : "tren";
  const metric: MapLayerKey = isMapLayerKey(sp.metric) ? sp.metric : "fishingEffort";
  const cmp = comparisonPeriod(filter, typeof sp.cmpFrom === "string" ? sp.cmpFrom : null);
  const defaults = defaultFilter(regions[0].id);
  // Pembanding: periode lain (wilayah sama) atau wilayah lain (periode sama).
  const others = regions.filter((r) => r.id !== region.id);
  const vsRegion = tab === "perbandingan" && sp.vs === "wilayah" && others.length > 0;
  const cmpRegion = vsRegion ? (others.find((r) => r.id === sp.cmpRegion) ?? others.find((r) => r.type === "wpp") ?? others[0]) : null;

  const part = <T extends DailyResult | CellsResult>(period: PeriodFilter, kind: "daily" | "cells", target: RegionSummary = region) =>
    loadPart<T>({ dataset: metric, kind, regionId: target.id, start: period.start, end: period.end }, target.geometryHash);
  const dailyA = part<DailyResult>(filter, "daily");
  const dailyB = tab === "perbandingan" ? (cmpRegion ? part<DailyResult>(filter, "daily", cmpRegion) : part<DailyResult>(cmp.period, "daily")) : null;
  const cellsA = tab === "hotspot" || (tab === "perbandingan" && !cmpRegion) ? part<CellsResult>(filter, "cells") : null;
  const cellsB = tab === "perbandingan" && !cmpRegion ? part<CellsResult>(cmp.period, "cells") : null;
  // Rincian armada: report per kapal (radar satelit belum diuji untuk pengelompokan per kapal).
  const vessels =
    tab === "kapal" && metric !== "sar"
      ? loadPart<VesselsResult>({ dataset: metric, kind: "vessels", regionId: region.id, start: filter.start, end: filter.end }, region.geometryHash)
      : null;
  // Antar-WPP: report harian tiap WPP pada periode yang sama (dipakai ulang dari cache bila sudah ada).
  const wppRows: WppRow[] =
    tab === "wpp"
      ? regions.filter((r) => r.type === "wpp").map((r) => ({ region: r, part: part<DailyResult>(filter, "daily", r), areaKm2: regionAreaKm2(r) }))
      : [];
  const candidates: Array<{ params: Part["params"]; status: Part["status"]; error: Part["error"] } | null> = [
    tab === "wpp" || tab === "kejadian" ? null : dailyA,
    dailyB,
    cellsA,
    cellsB,
    vessels,
    ...wppRows.map((w) => w.part),
  ];
  const needed = candidates.filter((p) => p !== null);
  const pending = needed.filter((p) => p.status !== "ready" && !p.error).map((p) => p.params);
  const failed = needed.filter((p) => p.error).map((p) => p.params);

  const link = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string") q.set(k, v);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    return `/analysis?${q}`;
  };

  return (
    <>
      <FilterBar
        regions={regions.map((r) => ({ id: r.id, name: r.name }))}
        applied={{ regionId: filter.regionId, from: filter.from, to: filter.to }}
        defaults={{ regionId: defaults.regionId, from: defaults.from, to: defaults.to }}
        maxDate={addDays(todayUtc(), -1)}
      />
      {error ? <Banner tone="warning" title={error} /> : null}
      <RegionNotice region={region} />

      <div className="flex flex-col gap-3">
        <nav aria-label="Jenis analisis" className="glass inline-flex w-fit max-w-full flex-wrap gap-1 rounded-button p-1">
          {TABS.map(([key, label]) => (
            <Link
              key={key}
              href={link({ tab: key })}
              aria-current={key === tab ? "page" : undefined}
              scroll={false}
              className={cn(
                "inline-flex h-9 items-center rounded-input px-4",
                key === tab ? "bg-primary font-semibold text-inverse" : "text-ink hover:bg-surface-subtle",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        {tab === "kejadian" ? null : (
        <nav aria-label="Metrik" className="flex flex-wrap gap-2">
          {MAP_LAYER_KEYS.map((key) => (
            <Link
              key={key}
              href={link({ metric: key })}
              aria-current={key === metric ? "true" : undefined}
              scroll={false}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-full border px-3",
                key === metric ? "border-primary bg-primary-soft font-semibold text-primary" : "border-border-control bg-surface hover:bg-surface-subtle",
              )}
            >
              <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ background: MAP_LAYERS[key].ramp[2] }} />
              {METRIC_COPY[key].short}
            </Link>
          ))}
        </nav>
        )}
      </div>

      <ReportLoader pending={pending} failed={failed} total={needed.length} />

      {tab === "tren" ? <TrendTab metric={metric} region={region} filter={filter} daily={dailyA} /> : null}
      {tab === "perbandingan" && others.length > 0 ? (
        <nav aria-label="Bandingkan dengan" className="flex flex-wrap items-center gap-2">
          <span className="text-ink-muted">Bandingkan dengan:</span>
          {(
            [
              ["periode", "Periode lain"],
              ["wilayah", "Wilayah lain"],
            ] as const
          ).map(([key, label]) => {
            const active = (key === "wilayah") === vsRegion;
            return (
              <Link
                key={key}
                href={link({ vs: key === "wilayah" ? "wilayah" : null })}
                aria-current={active ? "true" : undefined}
                scroll={false}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-4",
                  active ? "border-primary bg-primary-soft font-semibold text-primary" : "border-border-control bg-white/70 hover:bg-white",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      ) : null}
      {tab === "perbandingan" && cmpRegion ? (
        <RegionCompareTab metric={metric} regionA={region} regionB={cmpRegion} others={others} filter={filter} sp={sp} dailyA={dailyA} dailyB={dailyB!} />
      ) : null}
      {tab === "perbandingan" && !cmpRegion ? (
        <CompareTab metric={metric} region={region} filter={filter} cmp={cmp} dailyA={dailyA} dailyB={dailyB!} cellsA={cellsA!} cellsB={cellsB!} />
      ) : null}
      {tab === "hotspot" ? <HotspotTab metric={metric} filter={filter} cells={cellsA!} regionAreaKm2={regionAreaKm2(region)} /> : null}
      {tab === "kapal" ? <FleetSection metric={metric} part={vessels} filter={filter} /> : null}
      {tab === "wpp" ? <WppRanking metric={metric} rows={wppRows} selectedId={region.id} filter={filter} /> : null}
      {tab === "kejadian" ? (
        <Suspense fallback={<StateView state="loading" title="Mengambil statistik kejadian dari Global Fishing Watch…" />}>
          <EventsTab region={region} filter={filter} />
        </Suspense>
      ) : null}
    </>
  );
}

function waiting(p: Part<DailyResult> | Part<CellsResult>, title: string) {
  if (p.result) return null;
  return p.status === "failed" ? (
    <StateView state="error">
      {title} gagal dimuat ({p.error?.code}). Nilai tidak ditampilkan sebagai nol.
    </StateView>
  ) : (
    <StateView state="loading" title={`Memuat ${title.toLowerCase()}…`} />
  );
}

function series(metric: MapLayerKey, cur: Part<DailyResult>, prev: Part<DailyResult> | null, a: PeriodFilter, b: PeriodFilter | null): TrendSeries {
  const def = MAP_LAYERS[metric];
  const notes: string[] = [];
  const missing = cur.result?.payload.daysWithoutRows.length ?? 0;
  if (missing) notes.push(`${missing} hari tidak ada data (tampil sebagai celah, bukan nol).`);
  if (metric === "sar") notes.push("Naik-turun deteksi radar ikut dipengaruhi jadwal lintasan satelit.");
  return {
    key: metric,
    label: def.metricLabel,
    unit: def.unit,
    valueFormat: def.format,
    color: `var(--color-data-${metric === "fishingEffort" ? "fishing" : metric})`,
    current: cur.result?.payload.series ?? null,
    previous: prev?.result?.payload.series ?? null,
    currentLabel: formatDateRangeUTC(a.from, a.to),
    previousLabel: b ? formatDateRangeUTC(b.from, b.to) : "",
    notes,
    state: cur.result ? "ready" : cur.status === "failed" ? "error" : "loading",
  };
}

function FlagTable({ metric, a, b, labels = ["dipilih", "pembanding"] }: { metric: MapLayerKey; a: DailyResult; b?: DailyResult | null; labels?: [string, string] }) {
  const bMap = new Map((b?.flagTotals ?? []).map((f) => [f.flag, f.value]));
  const totalA = a.total ?? 0;
  const rows = a.flagTotals.slice(0, 10).map((f) => ({ ...f, b: b ? bMap.get(f.flag) ?? null : undefined }));
  return (
    <DataTable
      caption="Komposisi menurut bendera kapal"
      rows={rows}
      rowKey={(r) => r.flag ?? "__unknown__"}
      columns={[
        { key: "flag", header: "Bendera kapal", cell: (r) => r.flag ?? <span className="text-ink-muted">Tidak diketahui</span> },
        { key: "a", header: `${MAP_LAYERS[metric].unit}${b ? ` (${labels[0]})` : ""}`, align: "right", cell: (r) => fmt(metric, r.value) },
        { key: "share", header: "Porsi", align: "right", cell: (r) => (totalA > 0 ? `${((r.value / totalA) * 100).toFixed(1).replace(".", ",")}%` : "—") },
        ...(b
          ? [
              { key: "b", header: `${MAP_LAYERS[metric].unit} (${labels[1]})`, align: "right" as const, cell: (r: (typeof rows)[number]) => (r.b == null ? <span className="text-ink-muted">tidak ada data</span> : fmt(metric, r.b)) },
            ]
          : []),
      ]}
    />
  );
}

function TrendTab({ metric, region, filter, daily }: { metric: MapLayerKey; region: RegionSummary; filter: PeriodFilter; daily: Part<DailyResult> }) {
  const r = daily.result;
  const days = r?.payload.series.filter((p) => p.value !== null).length ?? 0;
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        <MetricCard label={`Total ${METRIC_COPY[metric].name.toLowerCase()}`} info={METRIC_COPY[metric].explain} value={r ? (r.payload.total === null ? null : fmt(metric, r.payload.total)) : null} unit={MAP_LAYERS[metric].unit} period={`${filter.days} hari UTC`} loading={!r && daily.status === "pending"} />
        <MetricCard label="Rata-rata per hari" value={r && r.payload.total !== null && days > 0 ? fmt(metric, r.payload.total / days) : null} unit={`${MAP_LAYERS[metric].unit}/hari`} period={`dari ${days} hari yang ada datanya`} loading={!r && daily.status === "pending"} />
        <MetricCard label="Hari tanpa data" info="Hari ketika sumber tidak mengirim data sama sekali. Hari ini tidak dihitung sebagai nol." value={r ? formatCount(r.payload.daysWithoutRows.length) : null} unit="hari" period={`dari ${filter.days} hari`} loading={!r && daily.status === "pending"} />
      </div>
      <Card>
        <CardHeader title="Naik-turun per hari" description={`${region.name} · ${formatDateRangeUTC(filter.from, filter.to)}`} />
        {waiting(daily, "Grafik harian") ?? <TrendChart series={[series(metric, daily, null, filter, null)]} initialKey={metric} regionName={region.name} />}
      </Card>
      {r ? <TrendStats metric={metric} daily={r.payload} /> : null}
      {r ? (
        <Card>
          <CardHeader title="Menurut bendera kapal" description="Negara bendera yang dipancarkan kapal lewat AIS." info="Bendera kapal belum tentu sama dengan kewarganegaraan pemiliknya. Kapal tanpa data bendera dikelompokkan sebagai “Tidak diketahui”." />
          <FlagTable metric={metric} a={r.payload} />
          <div className="mt-3">
            <ProvenanceDetails provenance={r.provenance} summary="Sumber data" />
          </div>
        </Card>
      ) : null}
    </>
  );
}

function CompareTab({
  metric,
  region,
  filter,
  cmp,
  dailyA,
  dailyB,
  cellsA,
  cellsB,
}: {
  metric: MapLayerKey;
  region: RegionSummary;
  filter: PeriodFilter;
  cmp: { period: PeriodFilter; error: string | null };
  dailyA: Part<DailyResult>;
  dailyB: Part<DailyResult>;
  cellsA: Part<CellsResult>;
  cellsB: Part<CellsResult>;
}) {
  const b = cmp.period;
  const totA = dailyA.result?.payload.total ?? null;
  const totB = dailyB.result?.payload.total ?? null;
  const change = dailyA.result && dailyB.result ? changePercent(totA, totB) : null;
  const comparison: MetricComparison | undefined =
    change?.kind === "percent"
      ? { kind: "percent", value: change.value, label: `dibanding ${formatDateRangeUTC(b.from, b.to)}` }
      : change?.kind === "not-computable"
        ? { kind: "not-computable", label: "periode pembanding nol" }
        : undefined;
  const cmpCells = cellsA.result && cellsB.result ? compareCells(cellsA.result.payload.cells, cellsB.result.payload.cells, 25, MAP_LAYERS[metric].format === "count") : null;
  const ramp = MAP_LAYERS[metric].ramp;
  const partialNote =
    (dailyA.result?.payload.daysWithoutRows.length ?? 0) + (dailyB.result?.payload.daysWithoutRows.length ?? 0) > 0
      ? "Ada hari tanpa data di salah satu periode, jadi perbandingan ini hanya gambaran kasar."
      : null;

  return (
    <>
      <Card>
        <CardHeader
          title="Bandingkan dengan periode lain"
          description="Secara bawaan dibandingkan dengan periode tepat sebelumnya. Pilih tanggal lain jika perlu."
          info="Kedua periode memakai ukuran, wilayah, dan skala warna yang sama, sehingga bisa dibandingkan langsung. Global Fishing Watch tidak mencantumkan apakah data kedua periode sudah lengkap."
        />
        <CompareForm current={b.from} days={filter.days} maxDate={addDays(todayUtc(), -filter.days)} />
        {cmp.error ? <Banner tone="warning" title={`${cmp.error} Memakai periode sebelumnya.`} className="mt-3" /> : null}
      </Card>

      {partialNote ? <Banner tone="warning" title={partialNote} /> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        <MetricCard label={`Periode dipilih · ${formatDateRangeUTC(filter.from, filter.to)}`} value={dailyA.result ? fmt(metric, totA) : null} unit={MAP_LAYERS[metric].unit} period={`${filter.days} hari UTC`} loading={!dailyA.result && dailyA.status === "pending"} comparison={comparison} />
        <MetricCard label={`Periode pembanding · ${formatDateRangeUTC(b.from, b.to)}`} value={dailyB.result ? fmt(metric, totB) : null} unit={MAP_LAYERS[metric].unit} period={`${b.days} hari UTC`} loading={!dailyB.result && dailyB.status === "pending"} />
        <MetricCard
          label="Selisih"
          value={totA !== null && totB !== null && dailyA.result && dailyB.result ? `${totA - totB >= 0 ? "+" : "−"}${fmt(metric, Math.abs(totA - totB))}` : null}
          unit={MAP_LAYERS[metric].unit}
          period="aktif − pembanding"
          loading={(!dailyA.result && dailyA.status === "pending") || (!dailyB.result && dailyB.status === "pending")}
        />
      </div>

      <Card>
        <CardHeader title="Naik-turun per hari, dua periode" description="Hari pertama periode dipilih disejajarkan dengan hari pertama periode pembanding, dan seterusnya." />
        {waiting(dailyA, "Grafik harian") ?? (
          <TrendChart
            series={[series(metric, dailyA, dailyB, filter, b)]}
            initialKey={metric}
            regionName={region.name}
            labels={{ current: "Periode dipilih", previous: "Periode pembanding" }}
          />
        )}
      </Card>

      {dailyA.result ? (
        <Card>
          <CardHeader title="Menurut bendera kapal" />
          <FlagTable metric={metric} a={dailyA.result.payload} b={dailyB.result?.payload ?? null} />
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="25 lokasi teramai: sekarang vs pembanding"
          description="Warna memakai skala yang sama untuk kedua periode, jadi warna yang sama berarti tingkat aktivitas yang sama."
          info="Skala dibagi menjadi 5 tingkat berdasarkan sebaran nilai kedua periode. “Tidak ada data” berarti lokasi itu tidak tercatat di periode pembanding."
        />
        {!cmpCells ? (
          waiting(cellsA.result ? cellsB : cellsA, "Data lokasi")
        ) : (
          <div className="flex flex-col gap-3">
            {cmpCells.bins ? (
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption" aria-label="Tingkat warna">
                {[cmpCells.bins.min, ...cmpCells.bins.thresholds].map((lo, i, arr) => (
                  <li key={lo} className="flex items-center gap-1">
                    <span aria-hidden className="size-3 rounded-sm" style={{ background: ramp[Math.min(4, i)] }} />
                    Tingkat {i + 1}: {i < arr.length - 1 ? `${fmt(metric, lo)} – < ${fmt(metric, arr[i + 1])}` : `≥ ${fmt(metric, lo)}`}
                  </li>
                ))}
              </ul>
            ) : null}
            <DataTable
              caption="Perbandingan sel teratas"
              rows={cmpCells.rows}
              rowKey={(r) => `${r.lat},${r.lon}`}
              columns={[
                { key: "rank", header: "#", align: "right", cell: (r) => r.rankA },
                { key: "cell", header: "Lokasi", cell: (r) => <span className="whitespace-nowrap">{formatLatLon(r.lat, r.lon)}</span> },
                {
                  key: "a",
                  header: "Periode dipilih",
                  align: "right",
                  cell: (r) => (
                    <span className="inline-flex items-center gap-2">
                      {fmt(metric, r.valueA)}
                      <span aria-label={`tingkat ${r.classA + 1}`} className="size-3 rounded-sm" style={{ background: ramp[Math.min(4, r.classA)] }} />
                    </span>
                  ),
                },
                {
                  key: "b",
                  header: "Pembanding",
                  align: "right",
                  cell: (r) =>
                    r.valueB === null ? (
                      <span className="text-ink-muted">tidak ada data</span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        {fmt(metric, r.valueB)}
                        <span aria-label={`tingkat ${(r.classB ?? 0) + 1}`} className="size-3 rounded-sm" style={{ background: ramp[Math.min(4, r.classB ?? 0)] }} />
                      </span>
                    ),
                },
                {
                  key: "d",
                  header: "Perubahan",
                  align: "right",
                  cell: (r) => {
                    if (r.valueB === null) return "—";
                    const c = changePercent(r.valueA, r.valueB);
                    return c.kind === "percent" ? formatPercent(c.value) : "—";
                  },
                },
              ]}
            />
            <p className="text-caption text-ink-muted">
              {formatCount(cmpCells.cellsA)} lokasi beraktivitas di periode dipilih, {formatCount(cmpCells.cellsB)} di periode pembanding. Kenaikan bukan berarti pelanggaran.
            </p>
          </div>
        )}
      </Card>
    </>
  );
}

function HotspotTab({ metric, filter, cells, regionAreaKm2 }: { metric: MapLayerKey; filter: PeriodFilter; cells: Part<CellsResult>; regionAreaKm2: number | null }) {
  const r = cells.result;
  if (!r) return <Card>{waiting(cells, "Data lokasi")}</Card>;
  return (
    <>
      <HotspotStats metric={metric} cells={r.payload} regionAreaKm2={regionAreaKm2} />
      <HotspotTable metric={metric} filter={filter} r={r} />
    </>
  );
}

function HotspotTable({ metric, filter, r }: { metric: MapLayerKey; filter: PeriodFilter; r: NonNullable<Part<CellsResult>["result"]> }) {
  const total = r.payload.total;
  const rows = r.payload.cells.slice(0, 50).map((c, i) => ({ ...c, rank: i + 1 }));
  const q = (c: { lat: number; lon: number }) =>
    new URLSearchParams({ region: filter.regionId, from: filter.from, to: filter.to, layer: metric, cell: `${c.lat},${c.lon}` }).toString();
  return (
    <Card>
      <CardHeader
        title={`50 lokasi dengan ${METRIC_COPY[metric].name.toLowerCase()} tertinggi`}
        description="Klik “Buka di peta” untuk melihat lokasinya."
        info="Peta dibagi menjadi kotak sekitar 11 × 11 km. Ini peringkat aktivitas yang terlihat — bukan prediksi, dan bukan peringkat risiko atau pelanggaran."
      />
      <DataTable
        caption="Lokasi teramai"
        rows={rows}
        rowKey={(c) => `${c.lat},${c.lon}`}
        columns={[
          { key: "rank", header: "#", align: "right", cell: (c) => c.rank },
          { key: "cell", header: "Lokasi", cell: (c) => <span className="whitespace-nowrap">{formatLatLon(c.lat, c.lon)}</span> },
          { key: "v", header: MAP_LAYERS[metric].unit, align: "right", cell: (c) => fmt(metric, c.value) },
          { key: "share", header: "Porsi dari total", align: "right", cell: (c) => (total > 0 ? `${((c.value / total) * 100).toFixed(2).replace(".", ",")}%` : "—") },
          {
            key: "flag",
            header: "Bendera terbanyak",
            cell: (c) => {
              const [flag, v] = c.byFlag[0] ?? [null, 0];
              return `${flag ?? "Tidak diketahui"} (${c.value > 0 ? Math.round((v / c.value) * 100) : 0}%)`;
            },
          },
          {
            key: "map",
            header: "Peta",
            cell: (c) => (
              <Link href={`/map?${q(c)}`} className="font-medium whitespace-nowrap text-primary underline underline-offset-2">
                Buka di peta<span className="sr-only"> sel {formatLatLon(c.lat, c.lon)}</span>
              </Link>
            ),
          },
        ]}
      />
      <p className="mt-3 text-caption text-ink-muted">
        {formatCount(r.payload.cellCount)} lokasi beraktivitas · total {fmt(metric, total)} {MAP_LAYERS[metric].unit}.
      </p>
      <div className="mt-3">
        <ProvenanceDetails provenance={r.provenance} summary="Sumber data" />
      </div>
    </Card>
  );
}

function RegionCompareTab({
  metric,
  regionA,
  regionB,
  others,
  filter,
  sp,
  dailyA,
  dailyB,
}: {
  metric: MapLayerKey;
  regionA: RegionSummary;
  regionB: RegionSummary;
  others: RegionSummary[];
  filter: PeriodFilter;
  sp: Record<string, string | string[] | undefined>;
  dailyA: Part<DailyResult>;
  dailyB: Part<DailyResult>;
}) {
  const totA = dailyA.result?.payload.total ?? null;
  const totB = dailyB.result?.payload.total ?? null;
  const short = (r: RegionSummary) => (r.type === "wpp" ? r.name.split(" · ")[0] : r.name);
  const ratio = totA !== null && totB !== null && totB > 0 ? totA / totB : null;
  const partialNote =
    (dailyA.result?.payload.daysWithoutRows.length ?? 0) + (dailyB.result?.payload.daysWithoutRows.length ?? 0) > 0
      ? "Ada hari tanpa data di salah satu wilayah, jadi perbandingan ini hanya gambaran kasar."
      : null;
  const hidden = Object.entries(sp).filter(([k, v]) => typeof v === "string" && k !== "cmpRegion") as Array<[string, string]>;
  const loadingA = !dailyA.result && dailyA.status === "pending";
  const loadingB = !dailyB.result && dailyB.status === "pending";

  return (
    <>
      <Card>
        <CardHeader
          title="Bandingkan dengan wilayah lain"
          description={`Periode sama (${formatDateRangeUTC(filter.from, filter.to)}), ukuran sama. Pilih wilayah pembanding.`}
          info="Wilayah yang lebih luas wajar punya angka lebih besar. Gunakan perbandingan ini untuk melihat pola, bukan untuk menilai wilayah mana yang “lebih buruk”. Global Fishing Watch tidak mencantumkan apakah data sudah lengkap."
        />
        <form method="get" action="/analysis" className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {hidden.map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-medium">Wilayah pembanding</span>
            <select name="cmpRegion" defaultValue={regionB.id} className="h-11 min-w-0 rounded-input border border-border-control bg-surface px-3">
              {others.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="secondary">
            Bandingkan
          </Button>
        </form>
      </Card>

      {partialNote ? <Banner tone="warning" title={partialNote} /> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        <MetricCard label={regionA.name} value={dailyA.result ? fmt(metric, totA) : null} unit={MAP_LAYERS[metric].unit} period={`${filter.days} hari UTC`} loading={loadingA} />
        <MetricCard label={regionB.name} value={dailyB.result ? fmt(metric, totB) : null} unit={MAP_LAYERS[metric].unit} period={`${filter.days} hari UTC`} loading={loadingB} />
        <MetricCard
          label={`${short(regionA)} dibanding ${short(regionB)}`}
          value={ratio === null ? null : `${ratio.toFixed(2).replace(".", ",")}×`}
          unit="kali lipat"
          period={totB === 0 ? "pembanding bernilai nol" : "perbandingan total"}
          loading={loadingA || loadingB}
        />
      </div>

      <Card>
        <CardHeader title="Naik-turun per hari, dua wilayah" description="Garis tegas = wilayah dipilih, garis putus-putus = wilayah pembanding." />
        {waiting(dailyA, "Grafik harian") ?? (
          <TrendChart
            series={[series(metric, dailyA, dailyB, filter, filter)]}
            initialKey={metric}
            regionName={`${regionA.name} dan ${regionB.name}`}
            labels={{ current: short(regionA), previous: short(regionB) }}
          />
        )}
      </Card>

      {dailyA.result ? (
        <Card>
          <CardHeader title="Menurut bendera kapal" />
          <FlagTable metric={metric} a={dailyA.result.payload} b={dailyB.result?.payload ?? null} labels={[short(regionA), short(regionB)]} />
        </Card>
      ) : null}
    </>
  );
}

async function EventsTab({ region, filter }: { region: RegionSummary; filter: PeriodFilter }) {
  const area = regionArea(region);
  if (!area) return <StateView state="error">Geometri wilayah tidak tersedia.</StateView>;
  const prev = comparisonPeriod(filter, null).period;
  const current = await loadEventSummary(area, filter.start, filter.end);
  const previous = await loadEventSummary(area, prev.start, prev.end);
  return <EventsSection current={current} previous={previous} filter={filter} prevPeriod={prev} />;
}
