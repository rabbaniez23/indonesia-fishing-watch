import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { Banner } from "@/components/ui/Banner";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateView } from "@/components/ui/StateView";
import { ClassComposition, CvChart, MonthlyHeatmap, RadianceHistogram, type CompositionRow } from "@/components/viirs/Charts";
import { AnnualByClass, ForecastSection, SeasonalGrid, TrendBadge, TrendGrid } from "@/components/viirs/ViirsSections";
import { DensityMap, MonthlyGridMap } from "@/components/viirs/ViirsMaps";
import { requireUser } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";
import { WPP_NAMES } from "@/lib/regions";
import { viirsAnnual, viirsMeta, viirsProfile, viirsRadianceHist, viirsStats } from "@/lib/viirs/data";
import { CLASS_LABEL, CLASS_RULE, MONTH_LONG, RADIANCE_UNIT, fmt2, fmt3, fmtP, fmtShare, fmtSigned, longDate, monthLabel } from "@/lib/viirs/format";
import { RADIANCE_CLASSES } from "@/lib/viirs/types";

export const metadata: Metadata = { title: "VIIRS" };

type Tab = "profil" | "peta" | "tren" | "musiman" | "prediksi";
const TABS: Array<[Tab, string]> = [
  ["profil", "Profil WPP"],
  ["peta", "Peta kepadatan"],
  ["tren", "Tren tahunan"],
  ["musiman", "Musiman"],
  ["prediksi", "Prediksi"],
];
const isTab = (v: unknown): v is Tab => typeof v === "string" && TABS.some(([k]) => k === v);

export default function ViirsPage({ searchParams }: PageProps<"/viirs">) {
  return (
    <PageContainer>
      <PageHeader
        title="VIIRS · Deteksi kapal malam"
        description="Pola aktivitas kapal penangkap ikan yang menyalakan lampu di malam hari, dari deteksi satelit VIIRS di 11 WPP-RI."
        info={
          <>
            VIIRS Boat Detection (EOG) mendeteksi sumber cahaya di laut pada malam hari. Deteksi mewakili cahaya yang tertangkap sensor, bukan
            identitas kapal, ukuran kapal, atau upaya penangkapan secara langsung.
          </>
        }
      />
      <Suspense fallback={<StateView state="loading" title="Memuat data VIIRS…" />}>
        <Viirs searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}

const wppLabel = (code: string) => `WPP ${code}`;

async function Viirs({ searchParams }: { searchParams: PageProps<"/viirs">["searchParams"] }) {
  await requireUser();
  const sp = await searchParams;
  const tab: Tab = isTab(sp.tab) ? sp.tab : "profil";
  const meta = viirsMeta;
  const codes = meta.wpp;
  const total = viirsProfile.total;
  const biggest = codes.reduce((a, b) => (viirsProfile.wpp[b].n > viirsProfile.wpp[a].n ? b : a));
  const period = `${monthLabel(meta.dateRange.start.slice(0, 7))} – ${monthLabel(meta.dateRange.end.slice(0, 7))}`;
  const lastYear = meta.years[meta.years.length - 1];
  const lastYearMonths = meta.monthsByYear[String(lastYear)];
  const partialYearNote = `${lastYear} baru berisi ${MONTH_LONG[lastYearMonths[0] - 1]}–${MONTH_LONG[lastYearMonths[lastYearMonths.length - 1] - 1]}, sehingga tidak dipakai dalam uji tren.`;

  return (
    <>
      <Banner tone="info" title={`${formatCount(total.n)} deteksi kapal di 11 WPP · ${period}`}>
        Angka dihitung ulang dari data VIIRS hasil cleaning dengan filter yang sama seperti paper (QF_Detect = 1, bukan daratan, ZEE Indonesia,
        di dalam WPP-RI), sehingga jumlah per WPP dapat berbeda dari Tabel 5 paper.{" "}
        <Link href="/preprocessing-viirs" className="font-medium text-primary underline underline-offset-2">
          Lihat preprocessing VIIRS
        </Link>
      </Banner>

      <nav aria-label="Bagian VIIRS" className="glass inline-flex w-fit max-w-full flex-wrap gap-1 rounded-button p-1">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`/viirs?tab=${key}`}
            aria-current={key === tab ? "page" : undefined}
            scroll={false}
            className={cn("inline-flex h-9 items-center rounded-input px-4", key === tab ? "bg-primary font-semibold text-inverse" : "text-ink hover:bg-surface-subtle")}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === "profil" ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total deteksi" value={formatCount(total.n)} unit="deteksi kapal" period={period} />
            <MetricCard label="Median radiansi" value={fmt2(total.median)} unit={RADIANCE_UNIT} period="seluruh deteksi" />
            <MetricCard label="WPP terbanyak" value={wppLabel(biggest)} unit={`${fmtShare(viirsProfile.wpp[biggest].share)} dari total`} period={WPP_NAMES[biggest]} />
            <MetricCard
              label="Kelas dominan"
              value={CLASS_LABEL[RADIANCE_CLASSES.reduce((a, b) => ((total.classPct[b] ?? 0) > (total.classPct[a] ?? 0) ? b : a))]}
              unit={RADIANCE_CLASSES.map((c) => `${CLASS_LABEL[c]} ${fmtShare(total.classPct[c])}`).join(" · ")}
              period=""
            />
          </div>
          <Card>
            <CardHeader
              title="Distribusi radiansi"
              description={`Gambar 4a paper · histogram skala log dengan ambang kelas 10 dan 400 ${RADIANCE_UNIT}.`}
              info="Radiansi miring ke kanan, jadi sumbu x memakai skala logaritmik. Median dipakai sebagai ukuran pusat karena tahan terhadap nilai ekstrem."
            />
            <RadianceHistogram hist={viirsRadianceHist} />
          </Card>
          <Card>
            <CardHeader
              title="Komposisi kelas radiansi"
              description="Gambar 4b & 5 paper · porsi kelas rendah, sedang, dan tinggi untuk seluruh wilayah dan tiap WPP."
              info="Kelas menggambarkan tingkat radiansi yang diterima sensor, bukan ukuran kapal, gross tonnage, atau jenis alat tangkap."
            />
            <ClassComposition
              caption="Komposisi kelas radiansi per WPP"
              rows={[
                { key: "total", label: "Semua WPP", n: total.n, classes: total.classes, pct: total.classPct, emphasis: true },
                ...codes.map<CompositionRow>((c) => ({
                  key: c,
                  label: wppLabel(c),
                  hint: WPP_NAMES[c],
                  n: viirsProfile.wpp[c].n,
                  classes: viirsProfile.wpp[c].classes,
                  pct: viirsProfile.wpp[c].classPct,
                })),
              ]}
            />
          </Card>
          <Card>
            <CardHeader title="Profil WPP" description="Tabel 5 paper · volume deteksi, median radiansi, dan komposisi kelas per WPP (hasil hitung ulang)." />
            <DataTable
              caption="Profil deteksi VIIRS per WPP"
              rows={[...codes.map((c) => ({ key: c, label: wppLabel(c), name: WPP_NAMES[c], ...viirsProfile.wpp[c] })), { key: "total", label: "Total", name: "11 WPP-RI", ...total }]}
              rowKey={(r) => r.key}
              columns={[
                { key: "w", header: "WPP", cell: (r) => <span className={cn("whitespace-nowrap", r.key === "total" && "font-semibold")}>{r.label}</span> },
                { key: "nm", header: "Perairan", cell: (r) => <span className="block max-w-[18rem] text-caption text-ink-muted">{r.name}</span> },
                { key: "n", header: "Deteksi", align: "right", cell: (r) => formatCount(r.n) },
                { key: "s", header: "Porsi", align: "right", cell: (r) => fmtShare(r.share) },
                { key: "m", header: `Median (${RADIANCE_UNIT})`, align: "right", cell: (r) => fmt2(r.median) },
                ...RADIANCE_CLASSES.map((c) => ({
                  key: c,
                  header: `${CLASS_LABEL[c]} ${CLASS_RULE[c]}`,
                  align: "right" as const,
                  cell: (r: { classPct: Record<string, number | null> }) => fmtShare(r.classPct[c]),
                })),
              ]}
            />
          </Card>
        </>
      ) : null}

      {tab === "peta" ? (
        <Card>
          <CardHeader
            title="Kepadatan deteksi kapal"
            description="Gambar 3, 6 & 7 paper · konsentrasi deteksi seluruh kelas dan per kelas radiansi."
            info="Area dengan kepadatan tinggi adalah hotspot deskriptif (konsentrasi deteksi), bukan hasil uji hotspot inferensial."
          />
          <DensityMap />
        </Card>
      ) : null}

      {tab === "tren" ? (
        <>
          <Card>
            <CardHeader title="Deteksi tahunan per kelas radiansi" description="Gambar 8 paper · dinamika tahunan kelas rendah, sedang, dan tinggi." />
            <AnnualByClass annual={viirsAnnual} partialYearNote={partialYearNote} />
          </Card>
          <Card>
            <CardHeader
              title={`Tren jangka panjang ${viirsStats.params.trendYears.join("–")}`}
              description="Gambar 9 paper · deteksi tahunan dengan kurva LOESS dan uji Mann-Kendall per WPP."
              info={`Mann-Kendall dua sisi, α = ${fmt2(viirsStats.params.alpha)}. Sen's slope = median kemiringan antar-pasangan tahun (deteksi/tahun). LOESS dengan fraksi ${fmt2(viirsStats.params.loessFrac)}.`}
            />
            <TrendGrid trend={viirsStats.trend} years={Array.from({ length: viirsStats.trend.total.values.length }, (_, i) => viirsStats.params.trendYears[0] + i)} order={codes} />
          </Card>
          <Card>
            <CardHeader
              title="Stabilitas tren (koefisien variasi)"
              description="Gambar 10 paper · CV deteksi tahunan: stabil (< 30%), cukup bervariasi (30–50%), sangat bervariasi (> 50%)."
            />
            <CvChart
              caption="Koefisien variasi deteksi tahunan per WPP"
              rows={codes.map((c) => ({ key: c, label: wppLabel(c), cv: viirsStats.trend[c].cv, cvClass: viirsStats.trend[c].cvClass, mean: viirsStats.trend[c].mean, sd: viirsStats.trend[c].sd }))}
            />
          </Card>
          <Card>
            <CardHeader title="Uji Mann-Kendall & Sen's slope" description={`Tabel 6 paper · ${viirsStats.params.trendYears.join("–")}.`} />
            <DataTable
              caption="Hasil uji Mann-Kendall dan Sen's slope per WPP"
              rows={[...codes.map((c) => ({ key: c, label: wppLabel(c), s: viirsStats.trend[c] })), { key: "total", label: "Semua WPP", s: viirsStats.trend.total }]}
              rowKey={(r) => r.key}
              columns={[
                { key: "w", header: "WPP", cell: (r) => <span className={cn("whitespace-nowrap", r.key === "total" && "font-semibold")}>{r.label}</span> },
                { key: "t", header: "Kendall τ", align: "right", cell: (r) => fmt3(r.s.tau) },
                { key: "p", header: "p-value", align: "right", cell: (r) => fmtP(r.s.p) },
                { key: "sen", header: "Sen's slope (deteksi/tahun)", align: "right", cell: (r) => fmtSigned(r.s.senSlope) },
                { key: "d", header: "Arah & signifikansi", cell: (r) => <TrendBadge stat={r.s} /> },
              ]}
            />
          </Card>
        </>
      ) : null}

      {tab === "musiman" ? (
        <>
          <Card>
            <CardHeader
              title="Komponen musiman (STL)"
              description={`Gambar 11 paper · indeks musiman hasil dekomposisi STL, ${monthLabel(viirsStats.params.seasonalRange[0])} – ${monthLabel(viirsStats.params.seasonalRange[1])}.`}
              info="STL (periode 12 bulan, robust) memisahkan seri bulanan menjadi tren, musiman, dan sisa. Indeks di sini adalah rata-rata komponen musiman tiap bulan kalender."
            />
            <SeasonalGrid seasonal={viirsStats.seasonal} order={codes} />
          </Card>
          <Card>
            <CardHeader title="Rata-rata deteksi bulanan" description="Gambar 12 paper · rata-rata deteksi per bulan kalender tiap WPP (warna berskala akar ^0,4)." />
            <MonthlyHeatmap
              caption="Rata-rata deteksi per bulan kalender per WPP"
              rows={codes.map((c) => ({ key: c, label: wppLabel(c), values: viirsStats.seasonal[c].monthlyMean }))}
            />
          </Card>
          <Card>
            <CardHeader title="Sebaran bulanan WPP 712 & 717 (2025)" description="Gambar 13 & 14 paper · pergeseran lokasi deteksi selama 12 bulan." />
            <MonthlyGridMap />
          </Card>
        </>
      ) : null}

      {tab === "prediksi" ? (
        <>
          <Card>
            <CardHeader
              title="Prediksi deteksi bulanan: SARIMA vs ETS"
              description="Gambar 15 paper · WPP 712 (paling padat) dan WPP 717 (paling jarang)."
              info={`SARIMA: ${viirsStats.params.forecast.sarimaGrid}. ETS: ${viirsStats.params.forecast.etsGrid}.`}
            />
            <ForecastSection forecast={viirsStats.forecast} />
          </Card>
          <Card>
            <CardHeader title="Uji Diebold-Mariano" description="Tabel 7 paper · apakah selisih akurasi SARIMA dan ETS signifikan secara statistik." info={viirsStats.params.forecast.dm} />
            <DataTable
              caption="Hasil uji Diebold-Mariano SARIMA vs ETS"
              rows={Object.entries(viirsStats.forecast).flatMap(([code, f]) =>
                (["mape", "rmse"] as const).map((loss) => ({ key: `${code}-${loss}`, code, loss, r: f.dm[loss] })),
              )}
              rowKey={(r) => r.key}
              columns={[
                { key: "w", header: "WPP", cell: (r) => wppLabel(r.code) },
                { key: "l", header: "Fungsi loss", cell: (r) => (r.loss === "mape" ? "MAPE (galat persentase absolut)" : "RMSE (galat kuadrat)") },
                { key: "d", header: "Statistik DM", align: "right", cell: (r) => fmtSigned(r.r.dm, 3) },
                { key: "p", header: "p-value", align: "right", cell: (r) => fmtP(r.r.p) },
                { key: "s", header: "Signifikansi (α = 0,05)", cell: (r) => (r.r.significant ? "Signifikan" : "Tidak signifikan") },
              ]}
            />
            <p className="mt-3 text-caption text-ink-muted">Statistik negatif berarti galat ETS lebih kecil daripada SARIMA pada periode uji.</p>
          </Card>
        </>
      ) : null}

      <p className="text-caption text-ink-muted">
        Sumber: Earth Observation Group (EOG) VIIRS Boat Detection, diolah. Data {longDate(meta.dateRange.start)} – {longDate(meta.dateRange.end)};
        ringkasan dibuat {longDate(meta.generatedAt.slice(0, 10))}.
      </p>
    </>
  );
}
