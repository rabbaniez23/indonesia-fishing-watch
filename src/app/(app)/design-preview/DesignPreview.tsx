"use client";

import { useState } from "react";
import { Filter, Plus, RotateCcw } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button, IconButton } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { DetailDrawer } from "@/components/ui/DetailDrawer";
import { Dialog } from "@/components/ui/Dialog";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateView, type DataState } from "@/components/ui/StateView";
import { Tabs } from "@/components/ui/Tabs";
import { formatCount, formatHours } from "@/lib/format";

const STATES: DataState[] = ["loading", "empty", "unknown", "partial", "stale", "error", "unsupported", "gated"];

type SampleRow = { id: string; label: string; value: number | null };
const SAMPLE_ROWS: SampleRow[] = [
  { id: "a", label: "Contoh baris A", value: 1234.5 },
  { id: "b", label: "Contoh baris B", value: 0 },
  { id: "c", label: "Contoh baris C", value: null },
];

export function DesignPreview() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <PageContainer>
      <Banner tone="info" title="Data contoh — bukan hasil pemantauan nyata.">
        Halaman ini hanya untuk pemeriksaan visual komponen design system dan tidak tersedia pada build produksi.
      </Banner>
      <PageHeader
        title="Pratinjau komponen"
        description="Token, tombol, badge, kartu KPI, tabel, tabs, dialog, drawer, dan state data."
        actions={
          <>
            <Button variant="secondary" icon={<Filter className="size-4" aria-hidden />}>
              Atur filter
            </Button>
            <Button icon={<Plus className="size-4" aria-hidden />}>Buat temuan</Button>
          </>
        }
      />

      <Card>
        <CardHeader title="Tombol" description="Tinggi 44px; compact 36px hanya desktop." />
        <div className="flex flex-wrap items-center gap-3">
          <Button>Terapkan</Button>
          <Button variant="secondary">Batal</Button>
          <Button variant="ghost">Lihat detail</Button>
          <Button variant="destructive">Hapus undangan</Button>
          <Button loading loadingLabel="Menerapkan…">
            Terapkan
          </Button>
          <Button disabled>Tidak tersedia</Button>
          <Button size="compact" variant="secondary">
            Compact
          </Button>
          <IconButton label="Reset ke wilayah" icon={<RotateCcw className="size-5" aria-hidden />} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Badge status" description="Status selalu teks + ikon, tidak hanya warna." />
        <div className="flex flex-wrap gap-2">
          <Badge tone="success">Laporan siap</Badge>
          <Badge tone="info">Data perkiraan</Badge>
          <Badge tone="warning">Hasil sebagian</Badge>
          <Badge tone="error">Sumber tidak dapat diakses</Badge>
          <Badge tone="neutral">Belum diketahui</Badge>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-4">
        <MetricCard
          label="Contoh · Jam apparent fishing"
          value={formatHours(12345.67)}
          unit="jam"
          period="Contoh periode"
          comparison={{ kind: "percent", value: 12.34, label: "Dibanding periode sebelumnya (contoh)" }}
          footer={<Badge tone="success">Lengkap</Badge>}
        />
        <MetricCard
          label="Contoh · Jam keberadaan berbasis AIS"
          value={formatHours(9876.5)}
          unit="jam"
          period="Contoh periode"
          comparison={{ kind: "not-computable", label: "periode sebelumnya bernilai nol (contoh)" }}
          footer={<Badge tone="warning">Hasil sebagian</Badge>}
        />
        <MetricCard
          label="Contoh · Deteksi radar"
          value={null}
          unit="deteksi"
          period="Contoh periode"
          footer={<Badge tone="neutral">Belum diketahui</Badge>}
        />
        <MetricCard label="Contoh · ID kapal unik" value={null} unit="ID kapal" period="Contoh periode" loading />
      </div>

      <Card>
        <CardHeader title="Tabel" description="Angka rata kanan; nilai kosong “Tidak tersedia”, bukan nol." />
        <DataTable
          caption="Contoh tabel"
          rows={SAMPLE_ROWS}
          rowKey={(row) => row.id}
          total={null}
          columns={[
            { key: "label", header: "Nama", cell: (row) => row.label },
            {
              key: "value",
              header: "Nilai (jam)",
              align: "right",
              cell: (row) => (row.value === null ? <span className="text-ink-muted">Tidak tersedia</span> : formatHours(row.value)),
            },
            { key: "count", header: "Jumlah (contoh)", align: "right", cell: () => formatCount(1500) },
          ]}
        />
      </Card>

      <Card>
        <CardHeader title="Tabs, dialog, dan drawer" />
        <Tabs
          label="Contoh tab profil"
          tabs={[
            { id: "identitas", label: "Identitas", content: <p>Panel identitas (contoh).</p> },
            { id: "aktivitas", label: "Aktivitas", content: <p>Panel aktivitas (contoh).</p> },
            { id: "kunjungan", label: "Kunjungan pelabuhan", content: <p>Panel kunjungan (contoh).</p> },
          ]}
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setDialogOpen(true)}>
            Buka dialog
          </Button>
          <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
            Buka drawer detail
          </Button>
        </div>
      </Card>

      <section className="flex flex-col gap-4" aria-labelledby="judul-state">
        <h2 id="judul-state" className="text-section-title font-semibold">
          State data
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STATES.map((state) => (
            <StateView key={state} state={state}>
              <code className="text-caption">{state}</code>
            </StateView>
          ))}
        </div>
      </section>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Buat laporan (contoh)"
        description="Pilih jenis laporan, wilayah, dan periode."
        size="form"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => setDialogOpen(false)}>Buat laporan</Button>
          </>
        }
      >
        <p>Isi form akan dibuat pada Tahap 9.</p>
      </Dialog>

      <DetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Sel grid (contoh)"
        subtitle="Jam apparent fishing · contoh periode"
        className="md:fixed md:top-16"
      >
        <p>Detail sel aktif akan tampil di sini (contoh).</p>
      </DetailDrawer>
    </PageContainer>
  );
}
