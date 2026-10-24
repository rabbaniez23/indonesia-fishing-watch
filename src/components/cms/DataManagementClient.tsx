"use client";

import { useState, useRef, useTransition, type ChangeEvent, type DragEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FolderUp,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
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
import {
  CATEGORY_LABELS,
  DATASET_CATEGORIES,
  type DatasetCategory,
  type ResearchDataset,
  type ValidationResult,
} from "@/lib/cms/types";

type Props = {
  initialDatasets: ResearchDataset[];
  userRole: string;
};

export function DataManagementClient({ initialDatasets, userRole }: Props) {
  const [datasets, setDatasets] = useState<ResearchDataset[]>(initialDatasets);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  // State Modal Upload
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState("");
  const [datasetCategory, setDatasetCategory] = useState<DatasetCategory>("vessel_sightings");
  const [datasetDesc, setDatasetDesc] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // State Modal Detail Preview
  const [previewDataset, setPreviewDataset] = useState<ResearchDataset | null>(null);

  // Drag & drop state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter datasets
  const filteredDatasets = datasets.filter((d) => {
    const matchCategory = filterCategory === "all" || d.category === filterCategory;
    const matchSearch =
      searchQuery === "" ||
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCategory && matchSearch;
  });

  // Hitung metrik ringkasan
  const totalDatasets = datasets.length;
  const spatialDatasets = datasets.filter((d) => d.summary.hasCoordinates).length;
  const totalRows = datasets.reduce((acc, curr) => acc + (curr.rowCount || 0), 0);

  // Handler memilih file & validasi instan
  async function handleFileSelected(file: File) {
    setSelectedFile(file);
    setUploadError(null);
    setValidationResult(null);

    // Defaultkan nama jika masih kosong
    if (!datasetName) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
      setDatasetName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }

    setIsValidating(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/cms/validate", { credentials: "same-origin", method: "POST", body: form });
      const json = await res.json();
      if (json.ok) {
        setValidationResult(json.data);
      } else {
        setUploadError(json.error?.message || "Validasi file gagal.");
      }
    } catch {
      setUploadError("Gagal menghubungi server validasi.");
    } finally {
      setIsValidating(false);
    }
  }

  function onFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  // Handler simpan dataset
  async function handleSaveDataset() {
    if (!selectedFile || !datasetName.trim()) {
      setUploadError("Nama dataset dan file wajib diisi.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const form = new FormData();
      form.append("file", selectedFile);
      form.append("name", datasetName.trim());
      form.append("category", datasetCategory);
      if (datasetDesc.trim()) form.append("description", datasetDesc.trim());

      const res = await fetch("/api/cms/datasets", {
        credentials: "same-origin",
        method: "POST",
        body: form,
      });
      const json = await res.json();

      if (json.ok) {
        setDatasets((prev) => [json.data, ...prev]);
        resetUploadModal();
        setIsUploadOpen(false);
      } else {
        setUploadError(json.error?.message || "Gagal mengunggah dataset.");
      }
    } catch {
      setUploadError("Terjadi kesalahan jaringan saat mengunggah dataset.");
    } finally {
      setIsUploading(false);
    }
  }

  function resetUploadModal() {
    setSelectedFile(null);
    setDatasetName("");
    setDatasetCategory("vessel_sightings");
    setDatasetDesc("");
    setValidationResult(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Handler Hapus
  async function handleDeleteDataset(id: string, name: string) {
    if (!confirm(`Hapus dataset "${name}"? File dan data yang tersimpan akan dihapus permanen.`)) return;

    try {
      const res = await fetch(`/api/cms/datasets/${id}`, {
        credentials: "same-origin",
        method: "DELETE",
      });
      const json = await res.json();
      if (json.ok) {
        setDatasets((prev) => prev.filter((d) => d.id !== id));
        if (previewDataset?.id === id) setPreviewDataset(null);
      } else {
        alert(json.error?.message || "Gagal menghapus dataset.");
      }
    } catch {
      alert("Kesalahan jaringan saat menghapus dataset.");
    }
  }

  async function refreshDatasets() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/cms/datasets", { credentials: "same-origin" });
        const json = await res.json();
        if (json.ok) setDatasets(json.data);
      } catch {
        // abaikan
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 3 Kotak Statistik Cepat */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card flex flex-col justify-between rounded-card border p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-caption font-medium text-ink-muted">Total Dataset Riset</span>
            <Database className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-3">
            <span className="tabular text-page-title font-semibold text-ink">{formatCount(totalDatasets)}</span>
            <span className="ml-2 text-caption text-ink-muted">dataset terdaftar</span>
          </div>
        </div>

        <div className="glass-card flex flex-col justify-between rounded-card border p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-caption font-medium text-ink-muted">Dataset Spasial / Koordinat</span>
            <MapPin className="h-5 w-5 text-chart-accent" />
          </div>
          <div className="mt-3">
            <span className="tabular text-page-title font-semibold text-ink">{formatCount(spatialDatasets)}</span>
            <span className="ml-2 text-caption text-ink-muted">memiliki koordinat peta</span>
          </div>
        </div>

        <div className="glass-card flex flex-col justify-between rounded-card border p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-caption font-medium text-ink-muted">Total Baris / Titik Observasi</span>
            <FileSpreadsheet className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-3">
            <span className="tabular text-page-title font-semibold text-ink">{formatCount(totalRows)}</span>
            <span className="ml-2 text-caption text-ink-muted">titik data terbaca</span>
          </div>
        </div>
      </div>

      {/* Bagian Aksi & Tabel Dataset */}
      <Card>
        <div className="flex flex-col gap-4 border-b border-border p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-section-title font-semibold text-ink">Katalog Dataset Mandiri</h2>
            <p className="text-body text-ink-muted">
              Kelola data pengamatan lapangan, pembaruan satelit VIIRS, dan lapisan peta yang diunggah peneliti.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="compact"
              icon={<RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />}
              onClick={refreshDatasets}
              disabled={isPending}
            >
              Segarkan
            </Button>
            <Button
              variant="primary"
              size="compact"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => {
                resetUploadModal();
                setIsUploadOpen(true);
              }}
            >
              Unggah Dataset Baru
            </Button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col gap-3 border-b border-border bg-neutral-bg/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-caption font-medium text-ink-muted">Kategori:</span>
            <button
              type="button"
              onClick={() => setFilterCategory("all")}
              className={`rounded-button px-3 py-1.5 text-caption font-medium transition-colors ${
                filterCategory === "all"
                  ? "bg-primary text-inverse"
                  : "bg-surface border border-border text-ink hover:bg-neutral-bg"
              }`}
            >
              Semua ({datasets.length})
            </button>
            {DATASET_CATEGORIES.map((cat) => {
              const count = datasets.filter((d) => d.category === cat).length;
              if (count === 0 && filterCategory !== cat) return null;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilterCategory(cat)}
                  className={`rounded-button px-3 py-1.5 text-caption font-medium transition-colors ${
                    filterCategory === cat
                      ? "bg-primary text-inverse"
                      : "bg-surface border border-border text-ink hover:bg-neutral-bg"
                  }`}
                >
                  {CATEGORY_LABELS[cat]} ({count})
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="search"
              placeholder="Cari nama atau file dataset…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-input border border-border-control bg-surface pl-9 pr-3 text-body placeholder:text-ink-muted"
            />
          </div>
        </div>

        {/* Tabel Data */}
        {filteredDatasets.length === 0 ? (
          <div className="py-12">
            <StateView
              state="empty"
              title="Belum ada dataset"
              action={
                <Button
                  variant="primary"
                  size="compact"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => {
                    resetUploadModal();
                    setIsUploadOpen(true);
                  }}
                >
                  Unggah Dataset Pertama
                </Button>
              }
            >
              {searchQuery || filterCategory !== "all"
                ? "Tidak ada dataset yang cocok dengan filter atau kata kunci pencarian."
                : "Unggah file CSV pengamatan atau GeoJSON wilayah riset untuk memulai."}
            </StateView>
          </div>
        ) : (
          <DataTable
            caption="Daftar dataset riset yang diunggah"
            rows={filteredDatasets}
            rowKey={(r) => r.id}
            total={filteredDatasets.length}
            columns={[
              {
                key: "name",
                header: "Nama Dataset & File",
                cell: (row) => (
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-ink">{row.name}</span>
                    <span className="text-caption text-ink-muted font-mono">{row.fileName}</span>
                    {row.description && <span className="text-caption text-ink-muted line-clamp-1">{row.description}</span>}
                  </div>
                ),
              },
              {
                key: "category",
                header: "Kategori",
                cell: (row) => (
                  <Badge tone={row.category === "custom_layer" ? "info" : "neutral"}>
                    {CATEGORY_LABELS[row.category] || row.category}
                  </Badge>
                ),
              },
              {
                key: "features",
                header: "Data / Fitur",
                cell: (row) => (
                  <div className="flex flex-col text-caption">
                    <span className="tabular font-medium text-ink">{formatCount(row.rowCount)} baris</span>
                    {row.summary.hasCoordinates ? (
                      <span className="flex items-center gap-1 text-[#166534]">
                        <MapPin className="h-3.5 w-3.5" /> Spasial ({row.summary.coordColumns?.lat || "lat"})
                      </span>
                    ) : (
                      <span className="text-ink-muted">Tanpa koordinat</span>
                    )}
                  </div>
                ),
              },
              {
                key: "uploader",
                header: "Diunggah Oleh",
                cell: (row) => (
                  <div className="flex flex-col text-caption text-ink-muted">
                    <span className="font-medium text-ink">{row.uploadedBy.name}</span>
                    <span>{formatDateTimeUTC(row.createdAt)}</span>
                  </div>
                ),
              },
              {
                key: "status",
                header: "Status",
                cell: (row) =>
                  row.status === "ready" ? (
                    <Badge tone="success">Siap</Badge>
                  ) : row.status === "failed" ? (
                    <Badge tone="warning">Gagal</Badge>
                  ) : (
                    <Badge tone="neutral">Validasi</Badge>
                  ),
              },
              {
                key: "actions",
                header: "Aksi",
                cell: (row) => (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      title="Lihat Pratinjau & Kolom"
                      onClick={() => setPreviewDataset(row)}
                      className="rounded-button p-1.5 text-primary hover:bg-primary-soft transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <a
                      href={`/api/cms/datasets/${row.id}?download=1`}
                      title="Unduh File Asli"
                      className="rounded-button p-1.5 text-ink hover:bg-neutral-bg transition-colors"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                    <button
                      type="button"
                      title="Hapus Dataset"
                      onClick={() => handleDeleteDataset(row.id, row.name)}
                      className="rounded-button p-1.5 text-error hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>

      {/* Modal / Dialog Upload Dataset Baru */}
      <Dialog
        open={isUploadOpen}
        onClose={() => {
          if (!isUploading) setIsUploadOpen(false);
        }}
        title="Unggah Dataset Riset Baru"
        description="Pilih atau tarik file CSV (pengamatan kapal/survei) atau GeoJSON (lapisan spasial) untuk divalidasi otomatis."
        size="form"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setIsUploadOpen(false)}
              disabled={isUploading}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveDataset}
              loading={isUploading}
              loadingLabel="Menyimpan Dataset…"
              disabled={!selectedFile || !datasetName.trim() || isValidating || Boolean(validationResult && !validationResult.valid)}
              icon={<CheckCircle2 className="h-4 w-4" />}
            >
              Simpan & Tampilkan
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-5 p-6">
          {/* Drag & Drop Area */}
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center rounded-card border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
              isDragging
                ? "border-primary bg-primary-soft/50"
                : selectedFile
                  ? "border-[#166534] bg-emerald-50/40"
                  : "border-border-control hover:border-primary hover:bg-neutral-bg/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.geojson,.json,.txt"
              onChange={onFileInputChange}
              className="hidden"
            />
            {selectedFile ? (
              <div className="flex flex-col items-center gap-2">
                <FileCheck className="h-10 w-10 text-primary" />
                <span className="font-semibold text-ink">{selectedFile.name}</span>
                <span className="text-caption text-ink-muted">
                  {(selectedFile.size / 1024).toFixed(1)} KB · Klik untuk mengganti file
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <FolderUp className="h-10 w-10 text-primary" />
                <span className="font-semibold text-ink">Tarik & lepas file data ke sini</span>
                <span className="text-caption text-ink-muted">
                  Format didukung: <strong>.CSV</strong> (tabel pengamatan) atau <strong>.GeoJSON</strong> (lapisan peta). Maks. 25 MB.
                </span>
              </div>
            )}
          </div>

          {/* Form Metadata */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Nama Dataset"
              placeholder="Contoh: Pengamatan Kapal Natuna Oktober 2026"
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
              helper="Nama yang akan ditampilkan di daftar dan pilihan analisis"
            />

            <SelectField
              label="Kategori Data"
              value={datasetCategory}
              onChange={(e) => setDatasetCategory(e.target.value as DatasetCategory)}
              helper="Pilih kelompok jenis data untuk mempermudah penyaringan"
            >
              {DATASET_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </SelectField>
          </div>

          <TextField
            label="Catatan / Deskripsi Riset (Opsional)"
            placeholder="Keterangan instansi pelaksana survei, metodologi singkat, atau tujuan riset…"
            value={datasetDesc}
            onChange={(e) => setDatasetDesc(e.target.value)}
          />

          {/* Status Validasi Real-time */}
          {isValidating && (
            <div className="flex items-center gap-3 rounded-button border border-border bg-neutral-bg/60 p-3 text-caption text-ink-muted">
              <RefreshCw className="h-4 w-4 animate-spin text-primary" />
              <span>Memeriksa kelayakan kolom dan koordinat file…</span>
            </div>
          )}

          {uploadError && (
            <div className="flex items-start gap-3 rounded-button border border-red-200 bg-red-50 p-4 text-caption text-error">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <div>
                <span className="font-semibold">Validasi Gagal: </span>
                {uploadError}
              </div>
            </div>
          )}

          {validationResult && validationResult.valid && (
            <div className="flex flex-col gap-3 rounded-card border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-caption font-semibold text-[#166534]">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Validasi Berhasil: File Siap Digunakan</span>
                </div>
                <Badge tone="success">{validationResult.rowCount.toLocaleString("id-ID")} Baris</Badge>
              </div>

              <p className="text-caption text-ink">{validationResult.summary.description}</p>

              {/* Peringatan (bila ada koordinat kosong) */}
              {validationResult.warnings.map((w, idx) => (
                <p key={idx} className="text-caption text-amber-800 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {w}
                </p>
              ))}

              {/* Pratinjau Kolom */}
              <div className="flex flex-col gap-1 mt-1">
                <span className="text-caption font-medium text-ink-muted">Kolom Terdeteksi:</span>
                <div className="flex flex-wrap gap-1">
                  {validationResult.columns.map((col) => (
                    <span
                      key={col}
                      className="rounded-button bg-white border border-border px-2 py-0.5 text-caption font-mono text-ink"
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </Dialog>

      {/* Modal Dialog Detail & Pratinjau Dataset */}
      <Dialog
        open={Boolean(previewDataset)}
        onClose={() => setPreviewDataset(null)}
        title={previewDataset?.name || "Detail Dataset"}
        description={`File: ${previewDataset?.fileName} · Diunggah oleh ${previewDataset?.uploadedBy.name}`}
        size="form"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-caption text-ink-muted">
              Diperbarui: {previewDataset ? formatDateTimeUTC(previewDataset.updatedAt) : "-"}
            </span>
            <div className="flex items-center gap-3">
              <a
                href={`/api/cms/datasets/${previewDataset?.id}?download=1`}
                className="inline-flex items-center gap-1.5 rounded-button bg-neutral-bg border border-border px-3 py-2 text-body font-medium text-ink hover:bg-surface"
              >
                <Download className="h-4 w-4" /> Unduh File
              </a>
              <Button variant="secondary" onClick={() => setPreviewDataset(null)}>
                Tutup
              </Button>
            </div>
          </div>
        }
      >
        {previewDataset && (
          <div className="flex flex-col gap-4 p-6 max-h-[70vh] overflow-y-auto">
            {/* Kartu Ringkasan */}
            <div className="flex flex-col gap-2 rounded-card border border-border bg-neutral-bg/40 p-4">
              <span className="text-caption font-semibold text-ink">Ringkasan Validasi</span>
              <p className="text-body text-ink">{previewDataset.summary.description || "Tidak ada ringkasan."}</p>
              {previewDataset.description && (
                <p className="text-caption text-ink-muted mt-1 italic">&ldquo;{previewDataset.description}&rdquo;</p>
              )}
            </div>

            {/* Kolom yang Tersedia */}
            <div className="flex flex-col gap-1.5">
              <span className="text-caption font-semibold text-ink">Kolom Data ({previewDataset.columns.length}):</span>
              <div className="flex flex-wrap gap-1.5">
                {previewDataset.columns.map((col) => (
                  <span
                    key={col}
                    className="rounded-button bg-surface border border-border px-2.5 py-1 text-caption font-mono text-ink"
                  >
                    {col}
                  </span>
                ))}
              </div>
            </div>

            {/* Pratinjau Tabel 10 Baris Pertama */}
            {previewDataset.previewRows.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-2">
                <span className="text-caption font-semibold text-ink">Pratinjau Sampel Data:</span>
                <div className="overflow-x-auto rounded-card border border-border">
                  <table className="w-full text-caption text-left">
                    <thead className="bg-neutral-bg border-b border-border text-ink font-semibold">
                      <tr>
                        {previewDataset.columns.slice(0, 6).map((c) => (
                          <th key={c} className="p-2.5 whitespace-nowrap">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {previewDataset.previewRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-neutral-bg/30">
                          {previewDataset.columns.slice(0, 6).map((c) => (
                            <td key={c} className="p-2.5 whitespace-nowrap font-mono text-ink">
                              {String(row[c] ?? "-")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <span className="text-caption text-ink-muted">
                  Menampilkan sampel baris awal data. Kolom lainnya dapat dilihat setelah diunduh.
                </span>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
