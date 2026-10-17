import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { OceanSourceTable } from "@/components/oseanografi/OceanSourceTable";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateView } from "@/components/ui/StateView";
import { requireUser } from "@/lib/auth/session";
import { oceanMeta } from "@/lib/oseanografi/data";
import { longDate } from "@/lib/viirs/format";

export const metadata: Metadata = { title: "Data oseanografi" };

export default function DokumentasiOseanografiPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Pengolahan data oseanografi"
        description="Dataset Copernicus Marine yang dipakai menu Oseanografi dan lapisan laut di Peta, serta cara datanya diringkas per WPP dan per bulan."
      />
      <Suspense fallback={<StateView state="loading" title="Memuat dokumentasi…" />}>
        <Content />
      </Suspense>
    </PageContainer>
  );
}

async function Content() {
  await requireUser();
  const g = oceanMeta.grid;
  const [c0, c1] = oceanMeta.climatology;
  const lonE = g.lon0 + g.nx * g.res;
  const latN = g.lat0 + g.ny * g.res;
  const steps: Array<{ title: string; body: string }> = [
    {
      title: "Unduh per bulan",
      body: `Data diambil lewat Copernicus Marine Toolbox untuk kotak ${g.lon0}–${lonE}° BT dan ${Math.abs(g.lat0)}° LS – ${latN}° LU. Produk bulanan dipakai langsung; angin (data per jam) diambil tiap 6 jam lalu dirata-ratakan per bulan.`,
    },
    {
      title: "Grid peta 0,25°",
      body: `Setiap bulan diubah ke grid seragam ${String(g.res).replace(".", ",")}° (± 28 km) dengan rata-rata blok, hanya untuk sel laut. Arah arus dan angin diringkas ke grid 1° untuk panah di peta.`,
    },
    {
      title: "Rata-rata per WPP",
      body: "Nilai tiap WPP adalah rata-rata sel di dalam batas WPP dengan bobot luas sel (cos lintang). Klorofil memakai rata-rata geometrik karena sebarannya sangat miring.",
    },
    {
      title: "Klimatologi bulanan",
      body: `Untuk tiap bulan kalender (Januari–Desember) dihitung rata-rata ${c0}–${c1} — periode yang sama dengan analisis tren VIIRS. Peta bulanan dan tab Musiman menampilkan klimatologi ini.`,
    },
    {
      title: "Tren jangka panjang",
      body: "Nilai tahunan (hanya tahun dengan 12 bulan lengkap) diuji dengan Mann-Kendall dan kemiringan Sen; ditampilkan sebagai perubahan per dekade. Suhu tersedia sejak 1993, klorofil sejak 1998.",
    },
    {
      title: "Kaitan dengan kapal VIIRS",
      body: "Korelasi Pearson antara pola musiman (12 bulan) variabel laut dan jumlah deteksi VIIRS per WPP, serta korelasi anomali bulanan (nilai dikurangi klimatologinya).",
    },
  ];
  return (
    <>
      <Card>
        <CardHeader title="Dataset yang dipakai" description="Semua dari Copernicus Marine Service; model reanalisis untuk fisika & kimia, satelit untuk biologi." />
        <OceanSourceTable variables={oceanMeta.variables} />
        <p className="mt-3 text-caption text-ink-muted">Generated using E.U. Copernicus Marine Service Information.</p>
      </Card>

      <Card>
        <CardHeader title="Cara data diolah" description="Dikerjakan offline sekali jalan; website hanya membaca hasil ringkasannya." />
        <ol className="flex flex-col gap-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-caption font-semibold text-primary">{i + 1}</span>
              <span>
                <span className="font-semibold text-ink">{s.title}. </span>
                <span className="text-ink">{s.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Kapan diperbarui" />
          <p className="text-ink">
            Ringkasan terakhir dibuat <strong className="font-semibold">{longDate(oceanMeta.generatedAt.slice(0, 10))}</strong>. Data ini tidak ter-update otomatis:
            pengelola menjalankan ulang skrip pengolahan (unduh → rakit) di komputer yang menyimpan akun Copernicus, lalu memasang versi baru website.
            Copernicus menambah data reanalisis beberapa bulan sekali, jadi pembaruan cukup sesekali.
          </p>
        </Card>
        <Card>
          <CardHeader title="Batasan" />
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-ink">
            <li>Fisika dan kimia berasal dari model, bukan pengukuran langsung; klorofil dari satelit dapat bolong saat tertutup awan.</li>
            <li>Peta bulanan adalah rata-rata {c0}–{c1}, bukan kondisi bulan tertentu (kecuali pilihan &quot;Terbaru&quot;).</li>
            <li>Gelombang hanya klimatologi model; angin hanya contoh tahun {oceanMeta.variables.find((v) => v.key === "wind")?.period.year ?? "2025"}.</li>
            <li>Grid 0,25° terlalu kasar untuk teluk dan perairan sangat dekat pantai.</li>
            <li>Korelasi dengan deteksi kapal menunjukkan pola yang searah, bukan sebab-akibat.</li>
          </ul>
        </Card>
      </div>

      <p className="text-caption text-ink-muted">
        Lihat datanya di{" "}
        <Link href="/oseanografi" className="font-medium text-primary underline underline-offset-2">
          menu Oseanografi
        </Link>{" "}
        atau pilih &quot;Lapisan laut&quot; di{" "}
        <Link href="/map" className="font-medium text-primary underline underline-offset-2">
          Peta
        </Link>
        .
      </p>
    </>
  );
}
