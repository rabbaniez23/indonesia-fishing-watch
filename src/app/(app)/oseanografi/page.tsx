import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { LearnSection } from "@/components/oseanografi/LearnSection";
import { OceanMap } from "@/components/oseanografi/OceanMap";
import { LinkSection, SeasonalSection, TrendSection } from "@/components/oseanografi/OceanSections";
import { Card, CardHeader } from "@/components/ui/Card";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateView } from "@/components/ui/StateView";
import { requireUser } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { oceanLink, oceanMeta, oceanSeasonal, oceanSeries, oceanTrends } from "@/lib/oseanografi/data";
import { MONTH_LONG, fmtP, fmtSignedNum, fmtVar, monthLabel } from "@/lib/oseanografi/format";
import { WPP_NAMES } from "@/lib/regions";

export const metadata: Metadata = { title: "Oseanografi" };

type Tab = "peta" | "musiman" | "tren" | "kapal" | "belajar";
const TABS: Array<[Tab, string]> = [
  ["peta", "Peta bulanan"],
  ["musiman", "Musiman per WPP"],
  ["tren", "Tren"],
  ["kapal", "Laut & kapal"],
  ["belajar", "Belajar"],
];
const isTab = (v: unknown): v is Tab => typeof v === "string" && TABS.some(([k]) => k === v);

export default function OseanografiPage({ searchParams }: PageProps<"/oseanografi">) {
  return (
    <PageContainer>
      <PageHeader
        title="Oseanografi"
        description="Kondisi laut Indonesia dari Copernicus Marine: suhu, salinitas, arus, klorofil, nutrien, gelombang, dan angin — per bulan, per WPP, dan kaitannya dengan aktivitas kapal."
        info="Data berasal dari produk reanalisis model dan observasi satelit Copernicus Marine Service, diringkas menjadi rata-rata bulanan per WPP dan peta grid 0,25°."
      />
      <Suspense fallback={<StateView state="loading" title="Memuat data oseanografi…" />}>
        <Ocean searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}

async function Ocean({ searchParams }: { searchParams: PageProps<"/oseanografi">["searchParams"] }) {
  await requireUser();
  const sp = await searchParams;
  const tab: Tab = isTab(sp.tab) ? sp.tab : "peta";
  const vars = oceanMeta.variables;
  const initialVar = vars.find((v) => v.key === sp.var)?.key ?? vars.find((v) => v.key === "sst")?.key ?? vars[0]?.key;
  if (!initialVar) return <StateView state="unknown" title="Data oseanografi belum dibangun" />;
  const areas = oceanMeta.wpp;
  const sst = oceanSeasonal.sst?.total;
  const sstTrend = oceanTrends.sst;
  const chl = oceanSeasonal.chl?.total;
  const latest = vars
    .map((v) => v.period.end)
    .filter((x): x is string => !!x)
    .sort()
    .pop();

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Suhu permukaan rata-rata"
          value={sst ? fmtVar("sst", avg(sst.mean), 1) : null}
          unit="°C"
          period={`11 WPP · ${oceanMeta.climatology.join("–")}`}
        />
        <MetricCard
          label="Tren suhu permukaan"
          value={sstTrend?.total?.senPerDecade != null ? fmtSignedNum(sstTrend.total.senPerDecade, 2) : null}
          unit="°C per dekade"
          period={sstTrend ? `${sstTrend.years[0]}–${sstTrend.years[sstTrend.years.length - 1]} · p ${fmtP(sstTrend.total.p)}` : ""}
        />
        <MetricCard
          label="Klorofil puncak"
          value={chl?.peak ? MONTH_LONG[chl.peak - 1] : null}
          unit={chl?.peak ? `${fmtVar("chl", chl.mean[chl.peak - 1])} mg/m³` : ""}
          period="rata-rata 11 WPP"
        />
        <MetricCard label="Data terbaru" value={latest ? monthLabel(latest) : null} unit={`${vars.length} variabel`} period="Copernicus Marine" />
      </div>

      <nav aria-label="Bagian oseanografi" className="glass inline-flex w-fit max-w-full flex-wrap gap-1 rounded-button p-1">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`/oseanografi?tab=${key}`}
            aria-current={key === tab ? "page" : undefined}
            scroll={false}
            className={cn("inline-flex h-9 items-center rounded-input px-4", key === tab ? "bg-primary font-semibold text-inverse" : "text-ink hover:bg-surface-subtle")}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === "peta" ? (
        <Card>
          <CardHeader
            title="Peta bulanan"
            description={`Pilih variabel dan bulan. Bulan Jan–Des = rata-rata ${oceanMeta.climatology.join("–")} (pola musim); “Terbaru” = bulan data terakhir.`}
            info="Arahkan kursor ke laut untuk melihat nilai sel 0,25° (±28 km). Arus dan angin dilengkapi panah arah pada grid 1°."
          />
          <OceanMap key={initialVar} variables={vars} initial={initialVar} />
        </Card>
      ) : null}

      {tab === "musiman" ? (
        <Card>
          <CardHeader title="Pola musiman per WPP" description="Rata-rata tiap bulan kalender untuk setiap WPP; titik menandai bulan puncak." />
          <SeasonalSection variables={vars} seasonal={oceanSeasonal} areas={areas} />
        </Card>
      ) : null}

      {tab === "tren" ? (
        <Card>
          <CardHeader
            title="Deret waktu & tren"
            description="Nilai bulanan sejak 2012 per wilayah, dan uji tren jangka panjang pada rata-rata tahunan."
            info="Suhu permukaan diuji sejak 1993 dan klorofil sejak 1998 (seluruh rentang data); variabel lain sejak 2012. Gelombang dan angin tidak memiliki deret tahunan di sini."
          />
          <TrendSection variables={vars} series={oceanSeries} trends={oceanTrends} areas={areas} />
        </Card>
      ) : null}

      {tab === "kapal" ? (
        <Card>
          <CardHeader
            title="Laut & aktivitas kapal malam"
            description="Bandingkan pola musiman variabel laut dengan jumlah deteksi kapal VIIRS per WPP (2012–2025)."
            info="Deteksi kapal dari menu VIIRS (QF_Detect = 1, di dalam WPP). Pola musiman = rata-rata per bulan kalender."
          />
          <LinkSection variables={vars} seasonal={oceanSeasonal} link={oceanLink} areas={areas} />
        </Card>
      ) : null}

      {tab === "belajar" ? (
        <Card>
          <CardHeader title="Belajar oseanografi" description="Konsep dasar laut Indonesia, langsung dihubungkan dengan data di halaman ini." />
          <LearnSection variables={vars} seasonal={oceanSeasonal} trends={oceanTrends} link={oceanLink} wppNames={WPP_NAMES} />
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Sumber data" description="Semua dataset dari Copernicus Marine Service, diringkas offline untuk halaman ini." />
        <p className="text-ink">
          {vars.length} variabel dari model reanalisis dan observasi satelit. Daftar dataset, periode, dan cara datanya diringkas ada di{" "}
          <Link href="/dokumentasi/oseanografi" className="font-medium text-primary underline underline-offset-2">
            Dokumentasi · Data oseanografi
          </Link>
          .
        </p>
        <p className="mt-3 text-caption text-ink-muted">
          Generated using E.U. Copernicus Marine Service Information. Ringkasan dibuat {oceanMeta.generatedAt.slice(0, 10)}.
        </p>
      </Card>
    </>
  );
}

function avg(vals: Array<number | null>): number | null {
  const f = vals.filter((v): v is number => v !== null);
  return f.length ? f.reduce((a, b) => a + b, 0) / f.length : null;
}
