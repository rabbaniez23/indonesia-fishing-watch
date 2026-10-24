"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  CircleDot,
  Eye,
  EyeOff,
  Layers,
  MapPin,
  Palette,
  Pentagon,
  Plus,
  RefreshCw,
  Share2,
  Sliders,
  Spline,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import { SelectField, TextField } from "@/components/ui/Field";
import { StateView } from "@/components/ui/StateView";
import { formatCount, formatDateTimeUTC } from "@/lib/format";
import type { CustomMapLayer, ResearchDataset } from "@/lib/cms/types";

type Props = {
  initialLayers: CustomMapLayer[];
  availableDatasets: ResearchDataset[];
  userRole: string;
};

const COLOR_PRESETS = [
  { name: "Hijau Emerald", value: "#166534" },
  { name: "Biru Samudra", value: "#1D4ED8" },
  { name: "Kuning Amber", value: "#D97706" },
  { name: "Merah Rose", value: "#E11D48" },
  { name: "Ungu Violet", value: "#7C3AED" },
  { name: "Toska Teal", value: "#0D9488" },
  { name: "Hitam Slate", value: "#1E293B" },
];

export function LayersManagementClient({ initialLayers, availableDatasets, userRole }: Props) {
  const [layers, setLayers] = useState<CustomMapLayer[]>(initialLayers);
  const [isPending, startTransition] = useTransition();

  // State Modal Buat Layer
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(
    availableDatasets[0]?.id || "",
  );
  const [layerName, setLayerName] = useState("");
  const [layerDesc, setLayerDesc] = useState("");
  const [layerType, setLayerType] = useState<"polygon" | "line" | "point">("polygon");
  const [color, setColor] = useState("#166534");
  const [opacity, setOpacity] = useState(0.8);
  const [isVisible, setIsVisible] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Filter dataset spasial yang valid
  const spatialDatasets = availableDatasets.filter(
    (d) => d.fileType === "geojson" || d.summary.hasCoordinates,
  );

  function resetCreateModal() {
    setSelectedDatasetId(spatialDatasets[0]?.id || "");
    setLayerName("");
    setLayerDesc("");
    setLayerType("polygon");
    setColor("#166534");
    setOpacity(0.8);
    setIsVisible(true);
    setCreateError(null);
  }

  // Handler auto-fill nama dan tipe saat dataset dipilih
  function onSelectDataset(datasetId: string) {
    setSelectedDatasetId(datasetId);
    const found = spatialDatasets.find((d) => d.id === datasetId);
    if (found) {
      if (!layerName) setLayerName(found.name);
      if (found.fileType === "csv") {
        setLayerType("point");
      } else if (found.summary.featureTypes?.includes("Polygon") || found.summary.featureTypes?.includes("MultiPolygon")) {
        setLayerType("polygon");
      } else if (found.summary.featureTypes?.includes("LineString")) {
        setLayerType("line");
      } else {
        setLayerType("point");
      }
    }
  }

  // Handler Submit Buat Layer
  async function handleCreateLayer() {
    if (!selectedDatasetId || !layerName.trim()) {
      setCreateError("Dataset sumber dan nama lapisan wajib diisi.");
      return;
    }

    setIsSaving(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/cms/layers", {
        credentials: "same-origin",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId: selectedDatasetId,
          name: layerName.trim(),
          description: layerDesc.trim() || undefined,
          layerType,
          color,
          opacity,
          isVisible,
        }),
      });

      const json = await res.json();
      if (json.ok) {
        setLayers((prev) => [json.data, ...prev]);
        setIsCreateOpen(false);
        resetCreateModal();
      } else {
        setCreateError(json.error?.message || "Gagal membuat lapisan peta.");
      }
    } catch {
      setCreateError("Terjadi kesalahan jaringan saat membuat lapisan peta.");
    } finally {
      setIsSaving(false);
    }
  }

  // Toggle Aktif / Non-aktif langsung
  async function handleToggleVisible(layer: CustomMapLayer) {
    const nextVal = !layer.isVisible;
    // Optimistic update
    setLayers((prev) => prev.map((l) => (l.id === layer.id ? { ...l, isVisible: nextVal } : l)));

    try {
      await fetch(`/api/cms/layers/${layer.id}`, {
        credentials: "same-origin",
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isVisible: nextVal }),
      });
    } catch {
      // Revert if error
      setLayers((prev) => prev.map((l) => (l.id === layer.id ? { ...l, isVisible: layer.isVisible } : l)));
    }
  }

  // Hapus Layer
  async function handleDeleteLayer(layer: CustomMapLayer) {
    if (!confirm(`Hapus lapisan peta "${layer.name}"? Dataset sumber tidak akan dihapus.`)) return;

    try {
      const res = await fetch(`/api/cms/layers/${layer.id}`, {
        credentials: "same-origin",
        method: "DELETE",
      });
      const json = await res.json();
      if (json.ok) {
        setLayers((prev) => prev.filter((l) => l.id !== layer.id));
      } else {
        alert(json.error?.message || "Gagal menghapus lapisan peta.");
      }
    } catch {
      alert("Kesalahan jaringan saat menghapus lapisan peta.");
    }
  }

  function refreshLayers() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/cms/layers", { credentials: "same-origin" });
        const json = await res.json();
        if (json.ok) setLayers(json.data);
      } catch {
        // ignore
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-4 border-b border-border p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-section-title font-semibold text-ink">Daftar Lapisan Peta Kustom</h2>
            <p className="text-body text-ink-muted">
              Lapisan yang ditandai <strong>Aktif</strong> akan otomatis muncul di panel samping halaman Peta utama.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="compact"
              icon={<RefreshCw className={`size-4 ${isPending ? "animate-spin" : ""}`} />}
              onClick={refreshLayers}
              disabled={isPending}
            >
              Segarkan
            </Button>
            <Button
              variant="primary"
              size="compact"
              icon={<Plus className="size-4" />}
              onClick={() => {
                resetCreateModal();
                setIsCreateOpen(true);
              }}
              disabled={spatialDatasets.length === 0}
            >
              + Tambah Lapisan Baru
            </Button>
          </div>
        </div>

        {spatialDatasets.length === 0 && (
          <div className="border-b border-amber-200 bg-amber-50/70 p-4 text-caption text-amber-900 flex items-center justify-between">
            <span>
              Belum ada file GeoJSON atau CSV berkoordinat. Silakan unggah dataset spasial terlebih dahulu di menu{" "}
              <strong>Data & Dataset Riset</strong>.
            </span>
            <Link
              href="/cms/data"
              className="font-semibold text-primary underline ml-4 whitespace-nowrap"
            >
              Unggah Dataset Sekarang →
            </Link>
          </div>
        )}

        {layers.length === 0 ? (
          <div className="py-12">
            <StateView
              state="empty"
              title="Belum ada lapisan peta kustom"
              action={
                spatialDatasets.length > 0 ? (
                  <Button
                    variant="primary"
                    size="compact"
                    icon={<Plus className="size-4" />}
                    onClick={() => {
                      resetCreateModal();
                      setIsCreateOpen(true);
                    }}
                  >
                    Buat Lapisan Peta Pertama
                  </Button>
                ) : (
                  <Link
                    href="/cms/data"
                    className="inline-flex items-center gap-2 rounded-button bg-primary px-4 py-2 text-caption font-medium text-inverse"
                  >
                    <Plus className="size-4" />
                    <span>Unggah Dataset Spasial</span>
                  </Link>
                )
              }
            >
              Pilih salah satu dataset riset yang telah diunggah untuk dikonfigurasikan menjadi lapisan visual di peta.
            </StateView>
          </div>
        ) : (
          <DataTable
            caption="Daftar lapisan peta kustom yang dikonfigurasi"
            rows={layers}
            rowKey={(r) => r.id}
            total={layers.length}
            columns={[
              {
                key: "name",
                header: "Nama Lapisan & Dataset",
                cell: (row) => (
                  <div className="flex items-center gap-3">
                    <span
                      className="size-5 shrink-0 rounded-full border border-black/20 shadow-xs"
                      style={{ backgroundColor: row.color, opacity: row.opacity }}
                      title={`Warna: ${row.color}`}
                    />
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-ink">{row.name}</span>
                      <span className="text-caption text-ink-muted">
                        Sumber: <span className="font-medium text-ink">{row.datasetName}</span>
                      </span>
                      {row.description && <span className="text-caption text-ink-muted line-clamp-1">{row.description}</span>}
                    </div>
                  </div>
                ),
              },
              {
                key: "type",
                header: "Tipe Geometri",
                cell: (row) => (
                  <div className="flex items-center gap-1.5 text-caption font-medium text-ink">
                    {row.layerType === "polygon" && <Pentagon className="size-4 text-primary" />}
                    {row.layerType === "line" && <Spline className="size-4 text-blue-600" />}
                    {row.layerType === "point" && <CircleDot className="size-4 text-amber-600" />}
                    <span className="capitalize">
                      {row.layerType === "polygon" ? "Area (Poligon)" : row.layerType === "line" ? "Garis (Line)" : "Titik (Point)"}
                    </span>
                  </div>
                ),
              },
              {
                key: "opacity",
                header: "Transparansi",
                cell: (row) => <span className="tabular text-caption text-ink">{Math.round(row.opacity * 100)}%</span>,
              },
              {
                key: "status",
                header: "Tampil di Peta",
                cell: (row) => (
                  <button
                    type="button"
                    onClick={() => handleToggleVisible(row)}
                    className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-80"
                    title="Klik untuk mengubah visibilitas di peta pengguna"
                  >
                    {row.isVisible ? (
                      <Badge tone="success">Aktif di Peta</Badge>
                    ) : (
                      <Badge tone="neutral">Disembunyikan</Badge>
                    )}
                  </button>
                ),
              },
              {
                key: "creator",
                header: "Dibuat Oleh",
                cell: (row) => (
                  <div className="flex flex-col text-caption text-ink-muted">
                    <span className="font-medium text-ink">{row.createdBy.name}</span>
                    <span>{formatDateTimeUTC(row.createdAt)}</span>
                  </div>
                ),
              },
              {
                key: "actions",
                header: "Aksi",
                cell: (row) => (
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/map`}
                      title="Lihat di Peta Utama"
                      className="rounded-button p-1.5 text-primary hover:bg-primary-soft transition-colors"
                    >
                      <Eye className="size-4" />
                    </Link>
                    <button
                      type="button"
                      title="Hapus Lapisan"
                      onClick={() => handleDeleteLayer(row)}
                      className="rounded-button p-1.5 text-error hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>

      {/* Modal Dialog Buat Lapisan Baru */}
      <Dialog
        open={isCreateOpen}
        onClose={() => {
          if (!isSaving) setIsCreateOpen(false);
        }}
        title="Konfigurasikan Lapisan Peta Baru"
        description="Pilih salah satu dataset riset spasial dan tentukan gaya tampilan visualnya di peta."
        size="form"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsCreateOpen(false)} disabled={isSaving}>
              Batal
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateLayer}
              loading={isSaving}
              loadingLabel="Menyimpan Lapisan…"
              disabled={!selectedDatasetId || !layerName.trim()}
              icon={<CheckCircle2 className="size-4" />}
            >
              Simpan & Aktifkan
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-5 p-6">
          {createError && (
            <div className="rounded-button border border-red-200 bg-red-50 p-3 text-caption text-error">
              {createError}
            </div>
          )}

          {/* Pilih Dataset */}
          <SelectField
            label="Dataset Sumber"
            value={selectedDatasetId}
            onChange={(e) => onSelectDataset(e.target.value)}
            helper="Pilih dari dataset GeoJSON atau CSV berkoordinat yang sudah diunggah"
          >
            {spatialDatasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.fileName} · {formatCount(d.rowCount)} baris)
              </option>
            ))}
          </SelectField>

          {/* Nama Lapisan */}
          <TextField
            label="Nama Lapisan di Peta"
            placeholder="Contoh: Kawasan Konservasi Laut Natuna"
            value={layerName}
            onChange={(e) => setLayerName(e.target.value)}
            helper="Nama ini akan tampil di saklar layer peta untuk pengguna"
          />

          {/* Jenis Geometri */}
          <div className="flex flex-col gap-1.5">
            <label className="font-medium text-ink">Bentuk Geometri</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { type: "polygon", label: "Area / Poligon", icon: Pentagon },
                { type: "line", label: "Garis / Rute", icon: Spline },
                { type: "point", label: "Titik / Posisi", icon: CircleDot },
              ].map((item) => {
                const Icon = item.icon;
                const isSel = layerType === item.type;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setLayerType(item.type as any)}
                    className={`flex flex-col items-center gap-1.5 rounded-card border p-3 text-center transition-colors ${
                      isSel
                        ? "border-primary bg-primary-soft text-primary font-semibold"
                        : "border-border bg-surface text-ink hover:bg-neutral-bg"
                    }`}
                  >
                    <Icon className="size-5" />
                    <span className="text-caption">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pilihan Warna */}
          <div className="flex flex-col gap-2">
            <label className="font-medium text-ink">Warna Tampilan</label>
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setColor(p.value)}
                  className={`size-8 rounded-full border-2 transition-transform ${
                    color === p.value ? "scale-110 border-ink shadow-sm ring-2 ring-primary/40" : "border-white"
                  }`}
                  style={{ backgroundColor: p.value }}
                  title={p.name}
                />
              ))}
              <div className="flex items-center gap-1.5 ml-2 border-l border-border pl-3">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="size-8 cursor-pointer rounded-button border border-border"
                />
                <span className="text-caption font-mono uppercase text-ink">{color}</span>
              </div>
            </div>
          </div>

          {/* Slider Opasitas */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="layer-opacity" className="font-medium text-ink">
                Kepekatan / Opasitas
              </label>
              <span className="tabular text-caption font-semibold text-primary">{Math.round(opacity * 100)}%</span>
            </div>
            <input
              id="layer-opacity"
              type="range"
              min="0.2"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              className="h-2 w-full accent-primary cursor-pointer"
            />
          </div>

          {/* Saklar Tampilkan di Peta */}
          <label className="flex items-center gap-3 cursor-pointer pt-2 border-t border-border">
            <input
              type="checkbox"
              checked={isVisible}
              onChange={(e) => setIsVisible(e.target.checked)}
              className="size-4 accent-primary rounded"
            />
            <div className="flex flex-col text-caption">
              <span className="font-semibold text-ink">Langsung Tampilkan di Peta Utama</span>
              <span className="text-ink-muted">Jika dicentang, layer ini langsung aktif di daftar layer pengguna.</span>
            </div>
          </label>
        </div>
      </Dialog>
    </div>
  );
}
