import Link from "next/link";
import { BarChart, type BarDatum } from "@/components/charts/BarChart";
import { ProvenanceDetails } from "@/components/analysis/ProvenanceDetails";
import { Banner } from "@/components/ui/Banner";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { MetricCard } from "@/components/ui/MetricCard";
import { StateView } from "@/components/ui/StateView";
import type { CellsResult, DailyResult, GroupTotal, VesselsResult } from "@/lib/analysis/aggregate";
import type { EventKindSummary } from "@/lib/analysis/event-summary";
import { changePercent } from "@/lib/analysis/metrics";
import type { Part } from "@/lib/analysis/parts";
import type { PeriodFilter } from "@/lib/analysis/period";
import { cellConcentration, describeSeries, flagGroups, stabilityLabel, weekdayPattern } from "@/lib/analysis/stats";
import { METRIC_COPY } from "@/lib/copy";
import { formatCount, formatDateRangeUTC, formatDateUTC, formatHours, formatPercent } from "@/lib/format";
import { MAP_LAYERS, type MapLayerKey } from "@/lib/map/layers";
import { WPP_OUTSIDE_EEZ, type RegionSummary } from "@/lib/regions";
import { vesselTypeLabel } from "@/lib/vessels/labels";

/**
 * Bagian statistik tambahan halaman Analisis. Semua angka dihitung dari snapshot report GFW yang sama dengan
 * grafik di atasnya; tidak ada skor risiko, label pelanggaran, atau angka perkiraan buatan aplikasi.
 */

const fmt = (metric: MapLayerKey, v: number | null) => (MAP_LAYERS[metric].format === "hours" ? formatHours(v) : formatCount(v));
const pct = (share: number | null) => (share === null || !Number.isFinite(share) ? "—" : `${(share * 100).toFixed(1).replace(".", ",")}%`);
const colorOf = (metric: MapLayerKey) => `var(--color-data-${metric === "fishingEffort" ? "fishing" : metric})`;

function Waiting({ part, title }: { part: Part; title: string }) {
  return part.status === "failed" ? (
    <StateView state="error">
      {title} gagal dimuat ({part.error?.code}). Nilai tidak ditampilkan sebagai nol.
    </StateView>
  ) : (
    <StateView state="loading" title={`Memuat ${title.toLowerCase()}…`} />
  );
}

// ---------------------------------------------------------------------------
// Naik-turun: statistik deskriptif, pola mingguan, komposisi bendera
// ---------------------------------------------------------------------------

export function TrendStats({ metric, daily }: { metric: MapLayerKey; daily: DailyResult }) {
  const s = describeSeries(daily.series);
  const unit = MAP_LAYERS[metric].unit;
  const week = weekdayPattern(daily.series);
  const groups = flagGroups(daily.flagTotals);
  if (!s) return null;
  const weekData: BarDatum[] = week.map((w) => ({
    key: w.day,
    label: w.day,
    value: w.mean,
    display: w.mean === null ? "tidak ada data" : `${fmt(metric, w.mean)} ${unit}`,
    extra: [["Jumlah hari dihitung", formatCount(w.days)]],
  }));
  const busiest = week.reduce<(typeof week)[number] | null>((b, w) => (w.mean !== null && (!b || w.mean > b.mean!) ? w : b), null);
  const quietest = week.reduce<(typeof week)[number] | null>((b, w) => (w.mean !== null && (!b || w.mean < b.mean!) ? w : b), null);

  return (
    <>
      <Card>
        <CardHeader
          title="Statistik harian"
          description={`Dihitung dari ${formatCount(s.days)} hari yang ada datanya. Hari tanpa data tidak dihitung sebagai nol.`}
          info="Median = nilai tengah harian (tidak terpengaruh satu hari yang sangat tinggi). Simpangan baku menunjukkan seberapa jauh nilai harian menyebar dari rata-rata."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard label="Hari tertinggi" value={fmt(metric, s.max.value)} unit={unit} period={`${formatDateUTC(s.max.date)} (UTC)`} />
          <MetricCard label="Hari terendah" value={fmt(metric, s.min.value)} unit={unit} period={`${formatDateUTC(s.min.date)} (UTC)`} />
          <MetricCard label="Median per hari" info="Nilai tengah: separuh hari lebih rendah, separuh lebih tinggi." value={fmt(metric, s.median)} unit={`${unit}/hari`} period={`rata-rata ${fmt(metric, s.mean)} ${unit}/hari`} />
          <MetricCard label="Simpangan baku harian" value={fmt(metric, s.std)} unit={unit} period="sebaran nilai antar-hari" />
          <MetricCard
            label="Kestabilan aktivitas"
            info="Dihitung dari koefisien variasi (simpangan baku ÷ rata-rata). Di bawah 15% = stabil, 15–35% = cukup bervariasi, di atas 35% = sangat bervariasi."
            value={stabilityLabel(s.cv)}
            unit=""
            period={s.cv === null ? "rata-rata nol" : `koefisien variasi ${pct(s.cv)}`}
          />
          <MetricCard label="Rentang harian" value={fmt(metric, s.max.value - s.min.value)} unit={unit} period="tertinggi − terendah" />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <Card>
          <CardHeader
            title="Pola hari dalam seminggu"
            description={busiest && quietest ? `Rata-rata tertinggi hari ${busiest.day}, terendah hari ${quietest.day}.` : undefined}
            info="Rata-rata per hari (UTC) dari hari yang ada datanya. Periode pendek hanya punya 1–5 hari per jenis hari, jadi pola ini gambaran kasar."
          />
          <BarChart data={weekData} caption={`Rata-rata ${METRIC_COPY[metric].name.toLowerCase()} per hari dalam seminggu`} valueHeader={`Rata-rata (${unit})`} color={colorOf(metric)} />
        </Card>
        <Card>
          <CardHeader
            title="Kapal Indonesia vs bendera lain"
            description="Porsi aktivitas menurut bendera yang dipancarkan kapal lewat AIS."
            info="Bendera kapal belum tentu sama dengan kewarganegaraan pemilik. Aktivitas kapal berbendera lain di perairan Indonesia bukan otomatis pelanggaran (mis. kapal niaga melintas atau kapal berizin)."
          />
          <ShareBar
            items={[
              { key: "idn", label: "Indonesia (IDN)", value: groups.domestic, color: "var(--color-data-fishing)" },
              { key: "foreign", label: `Bendera lain (${formatCount(groups.foreignFlags)} negara)`, value: groups.foreign, color: "var(--color-data-port)" },
              { key: "unknown", label: "Tidak diketahui", value: groups.unknown, color: "var(--color-data-unknown)" },
            ]}
            total={groups.total}
            format={(v) => `${fmt(metric, v)} ${unit}`}
          />
        </Card>
      </div>
    </>
  );
}

/** Satu batang bertumpuk (porsi) + legenda berlabel; identitas tidak hanya lewat warna. */
export function ShareBar({
  items,
  total,
  format,
}: {
  items: Array<{ key: string; label: string; value: number; color: string }>;
  total: number;
  format: (v: number) => string;
}) {
  if (!(total > 0)) return <p className="text-ink-muted">Tidak ada data untuk dihitung.</p>;
  const visible = items.filter((i) => i.value > 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-[4px]" role="img" aria-label={visible.map((i) => `${i.label} ${pct(i.value / total)}`).join(", ")}>
        {visible.map((i) => (
          <span key={i.key} style={{ width: `${(i.value / total) * 100}%`, background: i.color, minWidth: 2 }} />
        ))}
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((i) => (
          <li key={i.key} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden className="size-3 shrink-0 rounded-sm" style={{ background: i.color }} />
              <span className="truncate text-ink">{i.label}</span>
            </span>
            <span className="tabular text-right whitespace-nowrap text-ink">
              <span className="font-semibold">{pct(i.value / total)}</span> <span className="text-ink-muted">· {format(i.value)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kapal & alat tangkap
// ---------------------------------------------------------------------------

function groupData(groups: GroupTotal[], metric: MapLayerKey, total: number, label: (k: string | null) => string, hint?: (k: string | null) => string | undefined): BarDatum[] {
  return groups.map((g) => ({
    key: g.key ?? "__unknown__",
    label: label(g.key),
    hint: hint?.(g.key),
    value: g.value,
    display: `${fmt(metric, g.value)} ${MAP_LAYERS[metric].unit}`,
    extra: [
      ["Jumlah kapal", formatCount(g.vessels)],
      ["Porsi", pct(total > 0 ? g.value / total : null)],
    ],
  }));
}

const codeLabel = (k: string | null) => (k ? (vesselTypeLabel(k) ?? k) : "Tidak diketahui");
const codeHint = (k: string | null) => (k && vesselTypeLabel(k) !== k ? k : undefined);

export function FleetSection({ metric, part, filter }: { metric: MapLayerKey; part: Part<VesselsResult> | null; filter: PeriodFilter }) {
  if (metric === "sar" || !part) {
    return (
      <StateView state="unsupported" title="Rincian kapal belum tersedia untuk radar satelit">
        Rincian per kapal untuk deteksi radar belum diuji dengan sumber data. Pilih “Penangkapan ikan” atau “Kehadiran kapal” di atas.
      </StateView>
    );
  }
  const r = part.result;
  if (!r) return <Card><Waiting part={part} title="Rincian kapal" /></Card>;
  const p = r.payload;
  const unit = MAP_LAYERS[metric].unit;
  if (!p.fleet) {
    return (
      <Card>
        <StateView state="partial" title="Rincian armada belum ada di data tersimpan ini">
          Data ini dibuat oleh pengambil data (worker) versi lama. Jalankan ulang <code>npm run worker</code>; rincian muncul saat data diperbarui.
        </StateView>
      </Card>
    );
  }
  const f = p.fleet;
  const histUnit = MAP_LAYERS[metric].format === "hours" ? "jam" : "deteksi";
  const histData: BarDatum[] = f.histogram.map((b) => ({
    key: String(b.lo),
    label: b.hi === null ? `≥ ${formatCount(b.lo)} ${histUnit}` : `${formatCount(b.lo)} – < ${formatCount(b.hi)} ${histUnit}`,
    value: b.vessels,
    display: `${formatCount(b.vessels)} kapal`,
    extra: [
      ["Porsi kapal", pct(p.uniqueVesselIds > 0 ? b.vessels / p.uniqueVesselIds : null)],
      [`Total ${unit}`, fmt(metric, b.value)],
    ],
  }));
  const flagData = f.byFlag.map((g) => ({
    key: g.key ?? "__unknown__",
    label: g.key ?? "Tidak diketahui",
    value: g.vessels,
    display: `${formatCount(g.vessels)} kapal`,
    extra: [
      [`Total ${unit}`, fmt(metric, g.value)] as [string, string],
      ["Porsi aktivitas", pct(p.total > 0 ? g.value / p.total : null)] as [string, string],
    ],
  }));
  const top = p.topVessels.slice(0, 20);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Jumlah kapal (ID AIS)" info="Identitas kapal AIS yang berbeda pada periode ini. Satu kapal kadang memakai lebih dari satu identitas." value={formatCount(p.uniqueVesselIds)} unit="kapal" period={formatDateRangeUTC(filter.from, filter.to)} />
        <MetricCard label={`Rata-rata ${unit} per kapal`} value={fmt(metric, f.meanPerVessel)} unit={unit} period={`median ${fmt(metric, f.medianPerVessel)} ${unit}`} />
        <MetricCard label="Porsi 10 kapal teratas" info="Berapa bagian dari total aktivitas yang berasal dari 10 kapal paling aktif. Makin besar, makin terpusat pada sedikit kapal." value={pct(f.top10Share)} unit="dari total" period={`${fmt(metric, p.total)} ${unit} total`} />
        <MetricCard label="Porsi 10% kapal teratas" value={pct(f.top10PctShare)} unit="dari total" period={`${formatCount(Math.max(1, Math.ceil(p.uniqueVesselIds * 0.1)))} kapal paling aktif`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <Card>
          <CardHeader
            title="Menurut alat tangkap"
            description={`Total ${unit} per jenis alat tangkap menurut klasifikasi Global Fishing Watch.`}
            info="Jenis alat tangkap diperkirakan Global Fishing Watch dari pola gerak dan data registrasi. “Belum dapat dipastikan” berarti modelnya belum yakin."
          />
          <BarChart data={groupData(f.byGear, metric, p.total, codeLabel, codeHint)} caption="Aktivitas menurut alat tangkap" valueHeader={`Total (${unit})`} color={colorOf(metric)} />
        </Card>
        <Card>
          <CardHeader title="Menurut jenis kapal" description={`Total ${unit} per jenis kapal.`} />
          <BarChart data={groupData(f.byVesselType, metric, p.total, codeLabel, codeHint)} caption="Aktivitas menurut jenis kapal" valueHeader={`Total (${unit})`} color={colorOf(metric)} />
        </Card>
        <Card>
          <CardHeader
            title="Jumlah kapal menurut bendera"
            description="Berapa kapal berbeda dari tiap negara bendera."
            info="Bendera yang dipancarkan lewat AIS; belum tentu sama dengan kewarganegaraan pemilik. Bukan indikasi pelanggaran."
          />
          <BarChart data={flagData} caption="Jumlah kapal menurut bendera" valueHeader="Jumlah kapal" color="var(--color-data-port)" />
        </Card>
        <Card>
          <CardHeader
            title={`Sebaran ${unit} per kapal`}
            description={`Kebanyakan kapal hanya sebentar; sedikit kapal menyumbang ${unit} yang besar.`}
            info="Setiap kapal dimasukkan ke satu kelompok menurut total nilainya selama periode."
          />
          <BarChart data={histData} caption={`Jumlah kapal menurut total ${unit}`} valueHeader="Jumlah kapal" color={colorOf(metric)} maxBars={10} />
        </Card>
      </div>

      <Card>
        <CardHeader title="20 kapal paling aktif" description="Klik nama kapal untuk melihat profilnya." info="Peringkat aktivitas yang terlihat — bukan peringkat risiko atau pelanggaran." />
        <DataTable
          caption="Kapal paling aktif"
          rows={top.map((v, i) => ({ ...v, rank: i + 1 }))}
          rowKey={(v) => v.vesselId}
          columns={[
            { key: "rank", header: "#", align: "right", cell: (v) => v.rank },
            {
              key: "name",
              header: "Kapal",
              cell: (v) => (
                <Link href={`/vessels/${encodeURIComponent(v.vesselId)}`} className="font-medium text-primary underline underline-offset-2">
                  {v.shipName || "Tanpa nama"}
                </Link>
              ),
            },
            { key: "flag", header: "Bendera", cell: (v) => v.flag ?? <span className="text-ink-muted">Tidak diketahui</span> },
            { key: "gear", header: "Alat tangkap / jenis", cell: (v) => codeLabel(v.geartype) },
            { key: "v", header: unit, align: "right", cell: (v) => fmt(metric, v.value) },
            { key: "s", header: "Porsi", align: "right", cell: (v) => pct(p.total > 0 ? v.value / p.total : null) },
          ]}
        />
        <div className="mt-3">
          <ProvenanceDetails provenance={r.provenance} summary="Sumber data" />
        </div>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Lokasi teramai: konsentrasi spasial
// ---------------------------------------------------------------------------

export function HotspotStats({ metric, cells, regionAreaKm2 }: { metric: MapLayerKey; cells: CellsResult; regionAreaKm2: number | null }) {
  const c = cellConcentration(cells.cells);
  if (!c) return null;
  const curve: BarDatum[] = c.curve
    .filter((pt) => pt.x > 0 && pt.x < 1)
    .map((pt) => ({
      key: String(pt.x),
      label: `${formatHours(pt.x * 100)}% lokasi teramai`,
      value: pt.y * 100,
      display: `${pct(pt.y)} aktivitas`,
      extra: [["Jumlah lokasi", formatCount(Math.ceil(pt.x * c.cellCount))]],
    }));
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Lokasi beraktivitas" info="Jumlah kotak ±11 × 11 km yang mencatat aktivitas." value={formatCount(c.cellCount)} unit="kotak" period="pada periode ini" />
        <MetricCard
          label="Perkiraan luas area beraktivitas"
          info="Jumlah luas kotak yang mencatat aktivitas (luas kotak menyesuaikan lintang). Perkiraan kasar, bukan luas wilayah tangkap resmi."
          value={formatCount(c.areaKm2)}
          unit="km²"
          period={regionAreaKm2 ? `${pct(c.areaKm2 / regionAreaKm2)} dari luas wilayah` : "luas wilayah belum diketahui"}
        />
        <MetricCard label="Porsi 10 lokasi teratas" value={pct(c.top10Share)} unit="dari total" period={`${fmt(metric, cells.total)} ${MAP_LAYERS[metric].unit} total`} />
        <MetricCard
          label="Lokasi penyumbang separuh aktivitas"
          info="Berapa lokasi teramai yang bersama-sama menyumbang 50% aktivitas. Makin sedikit, makin terpusat."
          value={formatCount(c.cellsFor50)}
          unit="kotak"
          period={`${pct(c.cellsFor50Share)} dari lokasi beraktivitas`}
        />
      </div>
      <Card>
        <CardHeader
          title="Seberapa terpusat aktivitasnya?"
          description="Porsi aktivitas yang terkumpul di sebagian kecil lokasi teramai."
          info="Contoh: “10% lokasi teramai → 60% aktivitas” berarti sepersepuluh kotak paling ramai menampung 60% dari seluruh aktivitas."
        />
        <BarChart data={curve} caption="Kurva konsentrasi aktivitas" valueHeader="Porsi aktivitas" color={colorOf(metric)} />
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Antar-WPP
// ---------------------------------------------------------------------------

export type WppRow = { region: RegionSummary; part: Part<DailyResult>; areaKm2: number | null };

export function WppRanking({ metric, rows, selectedId, filter }: { metric: MapLayerKey; rows: WppRow[]; selectedId: string; filter: PeriodFilter }) {
  if (rows.length === 0) {
    return <StateView state="gated" title="Belum ada WPP yang diimpor">Impor poligon WPP terlebih dahulu (lihat README).</StateView>;
  }
  const unit = MAP_LAYERS[metric].unit;
  const ready = rows.filter((r) => r.part.result && r.part.result.payload.total !== null);
  const sum = ready.reduce((s, r) => s + (r.part.result!.payload.total ?? 0), 0);
  const code = (r: RegionSummary) => r.name.split(" · ")[0];
  const place = (r: RegionSummary) => r.name.split(" · ").slice(1).join(" · ");
  const outside = (r: RegionSummary) => !!WPP_OUTSIDE_EEZ[r.id.replace("wpp-", "")];
  const totals: BarDatum[] = rows
    .map((r) => {
      const t = r.part.result?.payload.total ?? null;
      const per1000 = t !== null && r.areaKm2 ? (t / r.areaKm2) * 1000 : null;
      return {
        key: r.region.id,
        label: code(r.region),
        hint: `${place(r.region)}${outside(r.region) ? " · sebagian di luar ZEE Indonesia" : ""}`,
        value: t,
        display: t === null ? (r.part.status === "failed" ? "gagal dimuat" : "memuat…") : `${fmt(metric, t)} ${unit}`,
        extra: [
          ["Porsi dari 11 WPP", pct(t !== null && sum > 0 ? t / sum : null)],
          [`Per 1.000 km²`, per1000 === null ? "—" : `${fmt(metric, per1000)} ${unit}`],
          ["Luas (perkiraan)", r.areaKm2 ? `${formatCount(r.areaKm2)} km²` : "—"],
        ] as Array<[string, string]>,
        highlight: r.region.id === selectedId,
      };
    })
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  const density: BarDatum[] = rows
    .map((r) => {
      const t = r.part.result?.payload.total ?? null;
      const v = t !== null && r.areaKm2 ? (t / r.areaKm2) * 1000 : null;
      return {
        key: r.region.id,
        label: code(r.region),
        hint: place(r.region),
        value: v,
        display: v === null ? "—" : `${fmt(metric, v)} ${unit}`,
        extra: [["Total", t === null ? "—" : `${fmt(metric, t)} ${unit}`], ["Luas (perkiraan)", r.areaKm2 ? `${formatCount(r.areaKm2)} km²` : "—"]] as Array<[string, string]>,
        highlight: r.region.id === selectedId,
      };
    })
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));

  return (
    <>
      <Banner tone="info" title="Perbandingan 11 WPP pada periode yang sama">
        {formatDateRangeUTC(filter.from, filter.to)} · {METRIC_COPY[metric].name}. WPP 571 dan 711 sebagian berada di luar ZEE Indonesia, jadi angkanya ikut
        memuat aktivitas di perairan negara tetangga.
      </Banner>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Total 11 WPP" value={ready.length ? fmt(metric, sum) : null} unit={unit} period={`${ready.length} dari ${rows.length} WPP siap`} loading={ready.length === 0} />
        <MetricCard label="WPP teramai" value={totals[0]?.value != null ? totals[0].label : null} unit="" period={totals[0]?.value != null ? `${totals[0].hint} · ${totals[0].display}` : ""} loading={ready.length === 0} />
        <MetricCard label="WPP terpadat (per luas)" info="Aktivitas dibagi luas laut WPP. Berguna untuk membandingkan WPP kecil dan besar secara adil." value={density[0]?.value != null ? density[0].label : null} unit="" period={density[0]?.value != null ? `${density[0].hint} · ${density[0].display} per 1.000 km²` : ""} loading={ready.length === 0} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <Card>
          <CardHeader title={`Total ${METRIC_COPY[metric].name.toLowerCase()} per WPP`} description="WPP yang dipilih di filter ditandai warna penuh." />
          <BarChart data={totals} caption="Total per WPP" valueHeader={`Total (${unit})`} color={colorOf(metric)} maxBars={11} />
        </Card>
        <Card>
          <CardHeader
            title="Kepadatan per 1.000 km²"
            description="Total dibagi luas laut tiap WPP."
            info="Luas dihitung dari poligon WPP pada bola bumi (perkiraan). Wilayah luas wajar punya total besar; kepadatan membantu membandingkan secara adil."
          />
          <BarChart data={density} caption="Kepadatan per WPP" valueHeader={`${unit} per 1.000 km²`} color={colorOf(metric)} maxBars={11} />
        </Card>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Kejadian di laut (events/stats)
// ---------------------------------------------------------------------------

const EVENT_COPY: Record<EventKindSummary["kind"], { title: string; explain: string }> = {
  fishing: {
    title: "Kegiatan menangkap ikan",
    explain: "Rangkaian waktu ketika kapal ikan terdeteksi sedang menangkap ikan (event penangkapan dari Global Fishing Watch).",
  },
  encounter: {
    title: "Pertemuan antar-kapal di laut",
    explain:
      "Dua kapal berdekatan cukup lama di laut, biasanya kapal pengangkut dan kapal ikan. Bisa menandakan alih muatan (transshipment), tetapi bukan bukti pelanggaran.",
  },
  loitering: {
    title: "Kapal berhenti lama di laut",
    explain: "Kapal bergerak sangat lambat atau diam cukup lama di laut lepas. Banyak alasan wajar (menunggu, cuaca); bukan bukti pelanggaran.",
  },
  port_visit: {
    title: "Kunjungan pelabuhan",
    explain: "Kapal masuk dan berlabuh di pelabuhan di dalam wilayah ini.",
  },
};

export function EventsSection({ current, previous, filter, prevPeriod }: { current: EventKindSummary[]; previous: EventKindSummary[]; filter: PeriodFilter; prevPeriod: PeriodFilter }) {
  const prev = new Map(previous.map((p) => [p.kind, p]));
  const anyError = current.some((c) => c.error);
  return (
    <>
      {anyError ? <Banner tone="warning" title="Sebagian jenis kejadian belum bisa dimuat. Nilainya tampil “—”, bukan nol." /> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {current.map((c) => {
          const p = prev.get(c.kind);
          const change = changePercent(c.numEvents, p?.numEvents ?? null);
          return (
            <MetricCard
              key={c.kind}
              label={EVENT_COPY[c.kind].title}
              info={EVENT_COPY[c.kind].explain}
              value={c.numEvents === null ? null : formatCount(c.numEvents)}
              unit="kejadian"
              period={c.numVessels === null ? formatDateRangeUTC(filter.from, filter.to) : `${formatCount(c.numVessels)} kapal · ${formatCount(c.numFlags)} bendera`}
              comparison={
                change.kind === "percent"
                  ? { kind: "percent", value: change.value, label: `dibanding ${formatDateRangeUTC(prevPeriod.from, prevPeriod.to)}` }
                  : change.kind === "not-computable"
                    ? { kind: "not-computable", label: "periode sebelumnya nol" }
                    : { kind: "unavailable", label: "periode sebelumnya belum tersedia" }
              }
              unknownText={c.error ? `Gagal dimuat (${c.error}).` : undefined}
            />
          );
        })}
      </div>
      <Card>
        <CardHeader
          title="Rincian kejadian, periode ini vs sebelumnya"
          description={`${formatDateRangeUTC(filter.from, filter.to)} dibanding ${formatDateRangeUTC(prevPeriod.from, prevPeriod.to)}.`}
          info="Kejadian dihitung bila tumpang-tindih dengan periode. Satu kapal bisa punya banyak kejadian."
        />
        <DataTable
          caption="Jumlah kejadian per jenis"
          rows={current}
          rowKey={(c) => c.kind}
          columns={[
            { key: "k", header: "Jenis kejadian", cell: (c) => EVENT_COPY[c.kind].title },
            { key: "n", header: "Kejadian", align: "right", cell: (c) => formatCount(c.numEvents) },
            { key: "v", header: "Kapal", align: "right", cell: (c) => formatCount(c.numVessels) },
            { key: "f", header: "Bendera", align: "right", cell: (c) => formatCount(c.numFlags) },
            { key: "pn", header: "Kejadian (sebelumnya)", align: "right", cell: (c) => formatCount(prev.get(c.kind)?.numEvents) },
            {
              key: "d",
              header: "Perubahan",
              align: "right",
              cell: (c) => {
                const ch = changePercent(c.numEvents, prev.get(c.kind)?.numEvents ?? null);
                return ch.kind === "percent" ? formatPercent(ch.value) : "—";
              },
            },
            {
              key: "per",
              header: "Kejadian per kapal",
              align: "right",
              cell: (c) => (c.numEvents !== null && c.numVessels ? formatHours(c.numEvents / c.numVessels) : "—"),
            },
          ]}
        />
        <p className="mt-3 text-caption text-ink-muted">
          Sumber: Global Fishing Watch, statistik kejadian (events/stats) untuk wilayah ini. Diambil{" "}
          {current[0]?.fetchedAt ? formatDateUTC(current[0].fetchedAt) : "—"}; disimpan sementara 6 jam. Kejadian adalah perilaku yang terlihat dari AIS, bukan bukti
          pelanggaran.
        </p>
      </Card>
    </>
  );
}
