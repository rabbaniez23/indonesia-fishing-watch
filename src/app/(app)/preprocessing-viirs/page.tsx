import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { BarChart } from "@/components/charts/BarChart";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateView } from "@/components/ui/StateView";
import { requireUser } from "@/lib/auth/session";
import { formatCount } from "@/lib/format";
import { viirsMeta, viirsPreprocessing, viirsStats } from "@/lib/viirs/data";
import { CLASS_LABEL, CLASS_RULE, RADIANCE_UNIT, fmt2, fmtShare, longDate, monthLabel } from "@/lib/viirs/format";
import { RADIANCE_CLASSES } from "@/lib/viirs/types";

export const metadata: Metadata = { title: "Preprocessing VIIRS" };

export default function PreprocessingViirsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Preprocessing VIIRS"
        description="Bagaimana data VIIRS Boat Detection diolah dari file mentah sampai menjadi dataset analisis yang ditampilkan di menu VIIRS."
      />
      <Suspense fallback={<StateView state="loading" title="Memuat ringkasan preprocessing…" />}>
        <Preprocessing />
      </Suspense>
    </PageContainer>
  );
}

/** Tabel 3 paper — kelompok atribut inti setelah cleaning. */
const ATTRIBUTES: Array<{ name: string; type: string; role: string }> = [
  { name: "Lat_DNB", type: "float", role: "Lintang pusat piksel DNB; posisi titik analisis." },
  { name: "Lon_DNB", type: "float", role: "Bujur pusat piksel DNB; posisi titik analisis." },
  { name: "Rad_DNB", type: "float", role: `Radiansi cahaya (${RADIANCE_UNIT}); dasar distribusi dan kelas intensitas.` },
  { name: "Date_Mscan / Date", type: "datetime", role: "Waktu pindai; dasar variabel tahun, bulan, tanggal, dan jam." },
  { name: "WPP_RI", type: "string", role: "Kode WPP-RI hasil penggabungan spasial; unit stratifikasi wilayah." },
  { name: "QF_Detect", type: "integer", role: "Kode kelas deteksi EOG; hanya nilai 1 yang dipertahankan." },
  { name: "QF_Bitflag", type: "integer", role: "Bitmask kualitas untuk pemeriksaan diagnostik." },
  { name: "Land_Mask", type: "integer", role: "Pembeda daratan, garis pantai, dan badan air untuk filter spasial." },
  { name: "EEZ", type: "string", role: "Konteks batas yurisdiksi; tidak dipakai sendiri untuk menyimpulkan aktivitas ilegal." },
  { name: "MPA", type: "string", role: "Konteks kawasan konservasi laut; tidak dipakai sendiri untuk menyimpulkan pelanggaran." },
  { name: "Rad_I04 & Glint", type: "float/flag", role: "Atribut diagnostik sumber panas dan pantulan; bukan ukuran langsung aktivitas penangkapan." },
];

/** Tabel 4 paper — komponen analisis dan teknik utamanya, beserta letaknya di menu VIIRS. */
const COMPONENTS: Array<{ name: string; technique: string; where: string }> = [
  { name: "Kepadatan spasial", technique: "Kepadatan kernel pada grid, parameter sama untuk semua kelas", where: "Peta kepadatan" },
  { name: "Distribusi radiansi", technique: "Sumbu logaritmik, median, histogram, kelas radiansi", where: "Profil WPP" },
  { name: "Profil WPP & kelas radiansi", technique: "Jumlah, persentase, komposisi, perubahan tahunan", where: "Profil WPP, Tren tahunan" },
  { name: "Tren jangka panjang", technique: "LOESS, Mann-Kendall, Sen's slope", where: "Tren tahunan" },
  { name: "Variabilitas antartahun", technique: "Rata-rata, simpangan baku, koefisien variasi", where: "Tren tahunan" },
  { name: "Pola musiman", technique: "STL (12 bulan), rata-rata bulanan, amplitudo musiman", where: "Musiman" },
  { name: "Prediksi & evaluasi", technique: "ETS, SARIMA, RMSE, MAPE, uji Diebold-Mariano", where: "Prediksi" },
];

async function Preprocessing() {
  await requireUser();
  const pre = viirsPreprocessing;
  const meta = viirsMeta;
  const paper = pre.paperTable2;
  const clean = pre.steps[0].records;
  const final = pre.steps[pre.steps.length - 1].records;
  const qfTotal = Object.values(pre.qfDetect).reduce((a, b) => a + b, 0);
  const landTotal = Object.values(pre.landMask).reduce((a, b) => a + b, 0);

  const stages = [
    {
      key: "raw",
      title: "1. Data mentah",
      value: formatCount(paper.raw.records),
      detail: `${paper.raw.attributes} kolom · ${fmt2(paper.raw.sizeGb)} GB`,
      note: "File CSV harian EOG VIIRS Boat Detection (angka dari Tabel 2 paper).",
    },
    {
      key: "clean",
      title: "2. Hasil cleaning",
      value: formatCount(clean),
      detail: `${paper.postCleaning.attributes} kolom inti · ${fmt2(paper.postCleaning.sizeGb)} GB`,
      note: "Kolom yang tidak relevan dibuang, waktu dibakukan, file per tahun digabung.",
    },
    {
      key: "filter",
      title: "3. Filter kualitas & spasial",
      value: formatCount(pre.steps.find((s) => s.id === "eez")?.records),
      detail: "QF_Detect = 1 · bukan daratan · ZEE Indonesia",
      note: "Hanya deteksi kategori kapal di perairan Indonesia yang diteruskan.",
    },
    {
      key: "final",
      title: "4. Dataset analisis",
      value: formatCount(final),
      detail: `di 11 WPP-RI · paper: ${formatCount(paper.analytical.records)}`,
      note: "Setiap titik diberi kode WPP, kelas radiansi, tahun, dan bulan.",
    },
  ];

  return (
    <>
      <Card>
        <CardHeader title="Alur pengolahan" description="Gambar 2 & Tabel 2 paper · dari file mentah sampai dataset analisis." />
        <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {stages.map((s) => (
            <li key={s.key} className="flex flex-col gap-1 rounded-button border border-border bg-white/60 p-4">
              <p className="font-semibold text-ink">{s.title}</p>
              <p className="tabular text-metric-mobile font-semibold text-ink">{s.value}</p>
              <p className="text-caption text-ink-muted">baris · {s.detail}</p>
              <p className="mt-1 text-caption text-ink">{s.note}</p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-caption text-ink-muted">
          Cleaning dari data mentah ke {formatCount(clean)} baris dilakukan sebelum data masuk ke website; jumlah baris hasil cleaning sama persis
          dengan Tabel 2 paper. Langkah 3–4 dihitung ulang untuk website dari data hasil cleaning.
        </p>
      </Card>

      <Card>
        <CardHeader
          title="Jumlah deteksi di setiap filter"
          description="Berapa baris yang tersisa setelah tiap langkah, dihitung dari data hasil cleaning."
        />
        <BarChart
          caption="Jumlah deteksi setelah setiap langkah filter"
          valueHeader="Deteksi"
          color="var(--color-data-fishing)"
          data={pre.steps.map((s) => ({
            key: s.id,
            label: s.label,
            value: s.records,
            display: formatCount(s.records),
            extra: [["Sisa dari data cleaning", fmtShare((s.records / clean) * 100)] as [string, string]],
          }))}
        />
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="QF_Detect" description="Kode kelas deteksi dari algoritma EOG pada data hasil cleaning." />
          <DataTable
            caption="Distribusi QF_Detect"
            rows={Object.entries(pre.qfDetect).map(([code, n]) => ({ code, n }))}
            rowKey={(r) => r.code}
            columns={[
              { key: "c", header: "Kode", cell: (r) => r.code },
              { key: "m", header: "Perlakuan", cell: (r) => (r.code === "1" ? "Kategori kapal (boat) — dipakai" : "Kategori lain — tidak dipakai") },
              { key: "n", header: "Baris", align: "right", cell: (r) => formatCount(r.n) },
              { key: "p", header: "Porsi", align: "right", cell: (r) => fmtShare((r.n / qfTotal) * 100) },
            ]}
          />
          <p className="mt-3 text-caption text-ink-muted">
            QF_Detect = 1 diperlakukan sebagai klasifikasi kualitas deteksi dari EOG, bukan bukti bahwa setiap titik pasti kegiatan penangkapan ikan.
          </p>
        </Card>
        <Card>
          <CardHeader title="Land_Mask" description="Pembeda daratan dan perairan untuk filter spasial." />
          <DataTable
            caption="Distribusi Land_Mask"
            rows={Object.entries(pre.landMask).map(([code, n]) => ({ code, n }))}
            rowKey={(r) => r.code}
            columns={[
              { key: "c", header: "Kode", cell: (r) => r.code },
              { key: "m", header: "Perlakuan", cell: (r) => (r.code === "1" ? "Daratan — dibuang" : "Perairan — dipakai") },
              { key: "n", header: "Baris", align: "right", cell: (r) => formatCount(r.n) },
              { key: "p", header: "Porsi", align: "right", cell: (r) => fmtShare((r.n / landTotal) * 100) },
            ]}
          />
        </Card>
      </div>

      <Card>
        <CardHeader title="Struktur atribut setelah cleaning" description="Tabel 3 paper · kolom inti yang dipertahankan dan perannya dalam analisis." />
        <DataTable
          caption="Struktur atribut inti data VIIRS"
          rows={ATTRIBUTES}
          rowKey={(r) => r.name}
          columns={[
            { key: "n", header: "Atribut", cell: (r) => <code className="font-mono text-caption">{r.name}</code> },
            { key: "t", header: "Tipe", cell: (r) => r.type },
            { key: "r", header: "Peran dalam analisis", cell: (r) => r.role },
          ]}
        />
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Kelas radiansi" description="Pengelompokan operasional deteksi menurut radiansi (mengadaptasi Tsuda dkk., 2023)." />
          <DataTable
            caption="Definisi kelas radiansi"
            rows={RADIANCE_CLASSES}
            rowKey={(c) => c}
            columns={[
              { key: "k", header: "Kelas", cell: (c) => CLASS_LABEL[c] },
              { key: "r", header: `Rentang Rad_DNB (${RADIANCE_UNIT})`, cell: (c) => CLASS_RULE[c] },
            ]}
          />
          <p className="mt-3 text-caption text-ink-muted">
            Kelas mencerminkan tingkat radiansi yang diterima sensor, bukan ukuran kapal, gross tonnage, kapasitas generator, atau jenis alat tangkap.
          </p>
        </Card>
        <Card>
          <CardHeader title="Komponen analisis" description="Tabel 4 paper · teknik yang dipakai dan letaknya di menu VIIRS." />
          <DataTable
            caption="Komponen analisis dan teknik utama"
            rows={COMPONENTS}
            rowKey={(r) => r.name}
            columns={[
              { key: "n", header: "Komponen", cell: (r) => r.name },
              { key: "t", header: "Teknik", cell: (r) => r.technique },
              { key: "w", header: "Tab", cell: (r) => r.where },
            ]}
          />
        </Card>
      </div>

      <Card>
        <CardHeader title="Catatan kualitas data" description="Hal yang ditemukan saat data hasil cleaning diperiksa ulang untuk website." />
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <strong>Rentang waktu:</strong> data tersedia {longDate(meta.dateRange.start)} – {longDate(meta.dateRange.end)}. Paper menyebut cakupan
            hingga Juli 2026; data yang diterima website berakhir {monthLabel(meta.dateRange.end.slice(0, 7))}. Tahun{" "}
            {meta.years[meta.years.length - 1]} tidak dipakai dalam uji tren ({viirsStats.params.trendYears.join("–")}).
          </li>
          <li>
            <strong>Jumlah per WPP dihitung ulang.</strong> Setiap titik ditandai WPP dengan uji titik-dalam-poligon terhadap 11 poligon WPP-RI. Total
            dataset analisis ({formatCount(final)}) hampir sama dengan paper ({formatCount(paper.analytical.records)}, selisih{" "}
            {fmtShare((Math.abs(final - paper.analytical.records) / paper.analytical.records) * 100)}), tetapi pembagian per WPP dapat berbeda dari Tabel 5
            paper.
          </li>
          <li>
            <strong>Baris duplikat:</strong> {formatCount(pre.notes.duplicates)} baris memiliki waktu, koordinat, radiansi, dan QF yang sama persis;{" "}
            {formatCount(pre.notes.duplicatesInFinal)} di antaranya ada di dataset analisis. Baris ini dibiarkan agar total tetap sebanding dengan paper.
          </li>
          <li>
            <strong>Radiansi ≤ 0:</strong> {formatCount(pre.notes.nonPositiveRadiance)} baris pada data hasil cleaning;{" "}
            {formatCount(pre.notes.nonPositiveRadianceInFinal)} di dataset analisis.
          </li>
          <li>
            <strong>Baris tidak valid:</strong> {formatCount(pre.notes.invalidRows)} baris tanpa waktu, koordinat, atau radiansi yang dapat diproses
            tidak diteruskan.
          </li>
        </ul>
        <p className="mt-4 text-caption text-ink-muted">
          Hasil analisis ditampilkan di{" "}
          <Link href="/viirs" className="font-medium text-primary underline underline-offset-2">
            menu VIIRS
          </Link>
          .
        </p>
      </Card>
    </>
  );
}
