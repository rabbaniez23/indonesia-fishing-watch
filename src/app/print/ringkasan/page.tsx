import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { StateView } from "@/components/ui/StateView";
import type { DailyResult } from "@/lib/analysis/aggregate";
import { buildOverview, kpiChange, KPI_DATASETS, type Part } from "@/lib/analysis/overview";
import { parseFilter } from "@/lib/analysis/period";
import { requireUser } from "@/lib/auth/session";
import { formatCount, formatDateRangeUTC, formatDateTimeUTC, formatHours, formatPercent } from "@/lib/format";
import { listRegions } from "@/lib/regions";
import { PrintButton } from "./PrintButton";

export const metadata: Metadata = { title: "Cetak ringkasan" };

/** Tampilan cetak ringkasan (FR-10 MVP; PDF terformat = P1). Hanya membaca snapshot yang sudah ada. */
export default function PrintSummaryPage({ searchParams }: PageProps<"/print/ringkasan">) {
  return (
    <main className="mx-auto max-w-[900px] bg-surface p-4 text-ink sm:p-6 print:max-w-none print:p-0">
      <Suspense fallback={<StateView state="loading" title="Memuat…" />}>
        <PrintContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const META = {
  fishingEffort: { label: "Jam apparent fishing", unit: "jam", fmt: formatHours },
  presence: { label: "Jam keberadaan berbasis AIS", unit: "jam", fmt: formatHours },
  sar: { label: "Deteksi radar", unit: "deteksi", fmt: formatCount },
} as const;

async function PrintContent({ searchParams }: { searchParams: PageProps<"/print/ringkasan">["searchParams"] }) {
  const user = await requireUser();
  const sp = await searchParams;
  const regions = listRegions().filter((r) => r.analyzable);
  if (regions.length === 0) return <StateView state="gated" title="Belum ada wilayah tervalidasi" />;
  const { filter } = parseFilter(sp, regions.map((r) => r.id));
  const region = regions.find((r) => r.id === filter.regionId)!;
  const overview = buildOverview(filter)!;
  const parts = KPI_DATASETS.map((d) => [d, overview.current[d], overview.prior[d]] as const);
  const missing = parts.some(([, c]) => !c.result);
  const q = new URLSearchParams({ region: filter.regionId, from: filter.from, to: filter.to });

  if (missing) {
    return (
      <StateView state="unknown" title="Snapshot ringkasan untuk periode ini belum lengkap.">
        Buka{" "}
        <Link href={`/overview?${q}`} className="font-medium text-primary underline">
          Ringkasan
        </Link>{" "}
        dengan filter yang sama agar data diambil, lalu kembali ke halaman cetak ini.
      </StateView>
    );
  }

  const series = (p: Part<DailyResult>) => p.result!.payload.series;
  const days = series(overview.current.fishingEffort).map((d) => d.date);

  return (
    <article className="flex flex-col gap-5 text-body">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-caption text-ink-muted">Indonesia Fishing Watch · ringkasan aktivitas maritim teramati</p>
          <h1 className="text-page-title font-semibold">{region.name}</h1>
          <p className="text-ink-muted">
            {formatDateRangeUTC(filter.from, filter.to)} · dibanding {formatDateRangeUTC(overview.previous.from, overview.previous.to)}
          </p>
          <p className="text-caption text-ink-muted">
            Dicetak {formatDateTimeUTC(new Date().toISOString())} oleh {user.name}
          </p>
        </div>
        <PrintButton />
      </header>

      <section aria-labelledby="kpi-cetak">
        <h2 id="kpi-cetak" className="mb-2 text-section-title font-semibold">
          Indikator utama
        </h2>
        <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border-control">
              <th className="py-2 pr-3">Metrik</th>
              <th className="py-2 pr-3 text-right">Periode aktif</th>
              <th className="py-2 pr-3 text-right">Pembanding</th>
              <th className="py-2 pr-3 text-right">Perubahan</th>
              <th className="py-2">Sumber · kelengkapan</th>
            </tr>
          </thead>
          <tbody>
            {parts.map(([d, cur, prev]) => {
              const m = META[d];
              const ch = kpiChange(cur, prev);
              return (
                <tr key={d} className="border-b border-border align-top">
                  <td className="py-2 pr-3">
                    {m.label} <span className="text-ink-muted">({m.unit})</span>
                  </td>
                  <td className="tabular py-2 pr-3 text-right">{m.fmt(cur.result!.payload.total)}</td>
                  <td className="tabular py-2 pr-3 text-right">{prev.result ? m.fmt(prev.result.payload.total) : "—"}</td>
                  <td className="tabular py-2 pr-3 text-right">
                    {ch?.kind === "percent" ? formatPercent(ch.value) : ch?.kind === "not-computable" ? "Tidak dapat dihitung" : "—"}
                  </td>
                  <td className="py-2 text-caption">
                    {cur.result!.provenance.datasetResolved ?? cur.result!.provenance.datasetRequested} · diambil{" "}
                    {formatDateTimeUTC(cur.result!.provenance.fetchedAt)} · kelengkapan belum diketahui
                  </td>
                </tr>
              );
            })}
            <tr className="align-top">
              <td className="py-2 pr-3">
                ID kapal unik <span className="text-ink-muted">(GFW vessel ID)</span>
              </td>
              <td className="tabular py-2 pr-3 text-right">{overview.vessels.result ? formatCount(overview.vessels.result.payload.uniqueVesselIds) : "—"}</td>
              <td className="py-2 pr-3 text-right">—</td>
              <td className="py-2 pr-3 text-right">—</td>
              <td className="py-2 text-caption">Belum tentu jumlah fisik kapal.</td>
            </tr>
          </tbody>
        </table>
        </div>
      </section>

      <section aria-labelledby="harian-cetak" className="break-inside-avoid-page">
        <h2 id="harian-cetak" className="mb-2 text-section-title font-semibold">
          Nilai harian (hari UTC)
        </h2>
        <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full border-collapse text-left text-caption">
          <thead>
            <tr className="border-b border-border-control">
              <th className="py-1 pr-3">Tanggal</th>
              {KPI_DATASETS.map((d) => (
                <th key={d} className="py-1 pr-3 text-right">
                  {META[d].label} ({META[d].unit})
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((date, i) => (
              <tr key={date} className="border-b border-border">
                <td className="py-1 pr-3">{date}</td>
                {KPI_DATASETS.map((d) => {
                  const v = series(overview.current[d])[i]?.value ?? null;
                  return (
                    <td key={d} className="tabular py-1 pr-3 text-right">
                      {v === null ? "tidak ada baris" : META[d].fmt(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>

      <footer className="border-t border-border pt-3 text-caption text-ink-muted">
        <p>
          Powered by Global Fishing Watch (globalfishingwatch.org), penggunaan nonkomersial. Batas wilayah: {region.source}. Apparent
          fishing adalah perkiraan dari pola AIS, bukan jumlah tangkapan; deteksi radar dipengaruhi cakupan satelit; data ini bukan
          penetapan pelanggaran. Hari tanpa baris dari provider tidak sama dengan nol.
        </p>
      </footer>
    </article>
  );
}
