"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Edit2,
  Eye,
  Filter,
  Lightbulb,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  UserCheck,
  X,
} from "lucide-react";
import { Badge, type StatusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatDateTimeUTC } from "@/lib/format";
import type {
  AnalysisInsight,
  InsightKind,
  InsightTab,
} from "@/lib/cms/types";
import {
  INSIGHT_KIND_LABELS,
  INSIGHT_KINDS,
  INSIGHT_TAB_LABELS,
  INSIGHT_TABS,
} from "@/lib/cms/types";

type RegionOption = {
  id: string;
  name: string;
  type: string;
};

type Props = {
  initialInsights: AnalysisInsight[];
  regions: RegionOption[];
};

export function AnalysisInsightsManagementClient({
  initialInsights,
  regions,
}: Props) {
  const [insights, setInsights] = useState<AnalysisInsight[]>(initialInsights);
  const [selectedTabFilter, setSelectedTabFilter] = useState<InsightTab | "semua">("semua");
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInsight, setEditingInsight] = useState<AnalysisInsight | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formKind, setFormKind] = useState<InsightKind>("interpretasi");
  const [formTab, setFormTab] = useState<InsightTab>("semua");
  const [formRegionId, setFormRegionId] = useState<string>("all");
  const [formMetric, setFormMetric] = useState<string>("semua");
  const [formIsActive, setFormIsActive] = useState(true);

  function openCreateModal() {
    setEditingInsight(null);
    setFormTitle("");
    setFormContent("");
    setFormKind("interpretasi");
    setFormTab("semua");
    setFormRegionId("all");
    setFormMetric("semua");
    setFormIsActive(true);
    setErrorMsg(null);
    setIsModalOpen(true);
  }

  function openEditModal(insight: AnalysisInsight) {
    setEditingInsight(insight);
    setFormTitle(insight.title);
    setFormContent(insight.content);
    setFormKind(insight.kind);
    setFormTab(insight.tab);
    setFormRegionId(insight.regionId || "all");
    setFormMetric(insight.metric || "semua");
    setFormIsActive(insight.isActive);
    setErrorMsg(null);
    setIsModalOpen(true);
  }

  async function handleToggleActive(insight: AnalysisInsight) {
    try {
      const res = await fetch(`/api/cms/analysis-insights/${insight.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !insight.isActive }),
      });
      const json = await res.json();
      if (json.ok && json.data) {
        setInsights((prev) =>
          prev.map((item) => (item.id === insight.id ? json.data : item)),
        );
      }
    } catch (err) {
      console.error("Gagal mengubah status aktif:", err);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Apakah Anda yakin ingin menghapus catatan analisis ini?")) return;
    try {
      const res = await fetch(`/api/cms/analysis-insights/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.ok) {
        setInsights((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (err) {
      console.error("Gagal menghapus catatan analisis:", err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!formTitle.trim() || !formContent.trim()) {
      setErrorMsg("Judul dan isi narasi catatan wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: formTitle.trim(),
        content: formContent.trim(),
        kind: formKind,
        tab: formTab,
        regionId: formRegionId === "all" ? null : formRegionId,
        metric: formMetric,
        isActive: formIsActive,
      };

      if (editingInsight) {
        // Update
        const res = await fetch(`/api/cms/analysis-insights/${editingInsight.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error?.message || "Gagal memperbarui catatan.");
        setInsights((prev) =>
          prev.map((item) => (item.id === editingInsight.id ? json.data : item)),
        );
      } else {
        // Create
        const res = await fetch("/api/cms/analysis-insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error?.message || "Gagal membuat catatan.");
        setInsights((prev) => [json.data, ...prev]);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan saat menyimpan catatan.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Filtered insights
  const filteredInsights = insights.filter((item) => {
    if (selectedTabFilter !== "semua" && item.tab !== selectedTabFilter) {
      return false;
    }
    if (selectedRegionFilter !== "all" && item.regionId !== selectedRegionFilter) {
      return false;
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchContent = item.content.toLowerCase().includes(q);
      const matchAuthor = item.author.name.toLowerCase().includes(q);
      if (!matchTitle && !matchContent && !matchAuthor) return false;
    }
    return true;
  });

  const activeCount = insights.filter((i) => i.isActive).length;

  return (
    <div className="flex flex-col gap-8">
      {/* Header Banner */}
      <div className="glass-card flex flex-col justify-between gap-6 rounded-card border border-border p-6 shadow-xs sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1.5 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-button bg-primary-soft px-2.5 py-1 text-caption font-semibold text-primary">
              <TrendingUp className="size-3.5" />
              Interpretasi Halaman /analysis
            </span>
          </div>
          <h1 className="text-page-title font-semibold text-ink">
            Catatan & Insight Analis (/analysis)
          </h1>
          <p className="text-body text-ink-muted leading-relaxed">
            Kelola narasi temuan lapangan, penjelasan tren musiman, dan catatan kritis yang ditampilkan
            secara langsung kepada pengguna saat mereka membuka halaman <strong>Statistik Aktivitas (/analysis)</strong>.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Button
            variant="primary"
            onClick={openCreateModal}
            className="flex items-center gap-2 shadow-xs"
          >
            <Plus className="size-4" />
            <span>Tambah Catatan Baru</span>
          </Button>
        </div>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card flex flex-col justify-between rounded-card border border-border p-5 shadow-xs">
          <span className="text-caption font-semibold uppercase tracking-wider text-ink-muted">
            Total Catatan
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="tabular text-3xl font-bold text-ink">{insights.length}</span>
            <span className="text-caption text-ink-muted">catatan tersimpan</span>
          </div>
        </div>

        <div className="glass-card flex flex-col justify-between rounded-card border border-border p-5 shadow-xs">
          <span className="text-caption font-semibold uppercase tracking-wider text-ink-muted">
            Tampil di /analysis
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="tabular text-3xl font-bold text-emerald-600">{activeCount}</span>
            <span className="text-caption text-ink-muted">aktif dipublikasikan</span>
          </div>
        </div>

        <div className="glass-card flex flex-col justify-between rounded-card border border-border p-5 shadow-xs">
          <span className="text-caption font-semibold uppercase tracking-wider text-ink-muted">
            Draft / Dinonaktifkan
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="tabular text-3xl font-bold text-ink-muted">
              {insights.length - activeCount}
            </span>
            <span className="text-caption text-ink-muted">hanya terlihat di CMS</span>
          </div>
        </div>
      </div>

      {/* Catalog & Filter Section */}
      <Card>
        {/* Filter Controls Header */}
        <div className="border-b border-border p-6 flex flex-col gap-4">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-section-title font-semibold text-ink">Daftar Insight & Catatan</h2>
              <p className="text-body text-ink-muted">
                Catatan kontekstual yang muncul pada tab dan wilayah yang sesuai
              </p>
            </div>

            <span className="text-caption text-ink-muted">
              Menampilkan <strong className="text-ink">{filteredInsights.length}</strong> catatan
            </span>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            {/* Search Box */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari judul catatan, isi narasi, atau nama analis..."
                className="w-full rounded-button border border-border bg-surface pl-9 pr-4 py-2 text-body text-ink placeholder:text-ink-muted focus:border-primary focus:outline-hidden"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Tab Filter */}
              <div className="flex items-center gap-1.5">
                <Filter className="size-4 text-ink-muted" />
                <select
                  value={selectedTabFilter}
                  onChange={(e) => setSelectedTabFilter(e.target.value as InsightTab)}
                  className="rounded-button border border-border bg-surface px-3 py-2 text-caption font-medium text-ink focus:border-primary focus:outline-hidden"
                >
                  {INSIGHT_TABS.map((tab) => (
                    <option key={tab} value={tab}>
                      {INSIGHT_TAB_LABELS[tab]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Region Filter */}
              <div className="flex items-center gap-1.5">
                <MapPin className="size-4 text-ink-muted" />
                <select
                  value={selectedRegionFilter}
                  onChange={(e) => setSelectedRegionFilter(e.target.value)}
                  className="rounded-button border border-border bg-surface px-3 py-2 text-caption font-medium text-ink focus:border-primary focus:outline-hidden max-w-[200px]"
                >
                  <option value="all">Semua Wilayah</option>
                  {regions.map((reg) => (
                    <option key={reg.id} value={reg.id}>
                      {reg.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* List of Insights */}
        {filteredInsights.length === 0 ? (
          <div className="p-12 text-center text-ink-muted">
            <Lightbulb className="mx-auto size-8 text-ink-muted mb-2" />
            <p className="font-medium text-ink">Belum ada catatan analisis</p>
            <p className="text-caption mt-1">
              Tambahkan catatan interpretasi agar pengunjung di /analysis memahami konteks data secara mendalam.
            </p>
            <div className="mt-4">
              <Button variant="primary" size="compact" onClick={openCreateModal}>
                <Plus className="size-4 mr-1" />
                <span>Buat Catatan Pertama</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredInsights.map((insight) => {
              const meta = INSIGHT_KIND_LABELS[insight.kind];
              const tone = meta?.tone || "info";

              return (
                <div
                  key={insight.id}
                  className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between hover:bg-surface/40 transition-colors"
                >
                  {/* Left: Info, Badges & Content */}
                  <div className="flex flex-col gap-2 min-w-0 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={tone}>{meta?.label || insight.kind}</Badge>
                      <span className="rounded-button bg-surface px-2.5 py-0.5 text-[11px] font-semibold text-primary border border-border">
                        Tab: {INSIGHT_TAB_LABELS[insight.tab]}
                      </span>
                      {insight.regionName && insight.regionName !== "Semua Wilayah" && (
                        <span className="rounded-button bg-surface px-2.5 py-0.5 text-[11px] font-medium text-ink-muted border border-border flex items-center gap-1">
                          <MapPin className="size-3 text-ink-muted" />
                          {insight.regionName}
                        </span>
                      )}
                      {!insight.isActive && (
                        <Badge tone="neutral">Nonaktif (Draft)</Badge>
                      )}
                    </div>

                    <h3 className="text-section-title font-semibold text-ink leading-snug">
                      {insight.title}
                    </h3>

                    <p className="text-body text-ink-muted line-clamp-3 leading-relaxed whitespace-pre-line">
                      {insight.content}
                    </p>

                    <div className="mt-1 flex items-center gap-3 text-caption text-ink-muted">
                      <span className="flex items-center gap-1 font-medium text-ink">
                        <UserCheck className="size-3.5 text-primary" />
                        {insight.author.name}
                      </span>
                      <span>•</span>
                      <span>Diperbarui {formatDateTimeUTC(insight.updatedAt)}</span>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex shrink-0 items-center gap-2 pt-1 sm:pt-0">
                    {/* Toggle Active Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleActive(insight)}
                      className={`rounded-button px-3 py-1.5 text-caption font-semibold transition-colors border ${
                        insight.isActive
                          ? "bg-emerald-50 text-[#166534] border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800"
                          : "bg-surface text-ink-muted border-border hover:bg-surface-hover"
                      }`}
                    >
                      {insight.isActive ? "Aktif di Peta" : "Draft / Mati"}
                    </button>

                    {/* Edit Button */}
                    <Button
                      variant="secondary"
                      size="compact"
                      onClick={() => openEditModal(insight)}
                      className="flex items-center gap-1"
                    >
                      <Edit2 className="size-3.5" />
                      <span>Edit</span>
                    </Button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => handleDelete(insight.id)}
                      className="rounded-button p-2 text-ink-muted hover:bg-red-50 hover:text-error transition-colors"
                      title="Hapus Catatan"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Modal Dialog Form (Create & Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="glass-card flex max-h-[90vh] w-full max-w-2xl flex-col rounded-card border border-border shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-primary" />
                <h3 className="text-section-title font-semibold text-ink">
                  {editingInsight ? "Edit Catatan Analisis" : "Tambah Catatan Analisis Baru"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-button p-1 text-ink-muted hover:bg-surface hover:text-ink"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              {errorMsg && (
                <div className="rounded-card bg-red-50 p-3 text-caption text-error border border-red-200">
                  {errorMsg}
                </div>
              )}

              {/* Judul */}
              <div className="flex flex-col gap-1.5">
                <label className="text-caption font-semibold text-ink">
                  Judul Temuan / Catatan <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Contoh: Lonjakan Penangkapan Musim Cumi di Natuna Utara"
                  className="rounded-button border border-border bg-surface px-3 py-2 text-body text-ink placeholder:text-ink-muted focus:border-primary focus:outline-hidden"
                />
              </div>

              {/* Grid 2 Kolom: Jenis & Tab Target */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Jenis Insight */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-caption font-semibold text-ink">
                    Jenis Catatan <span className="text-error">*</span>
                  </label>
                  <select
                    value={formKind}
                    onChange={(e) => setFormKind(e.target.value as InsightKind)}
                    className="rounded-button border border-border bg-surface px-3 py-2 text-body text-ink focus:border-primary focus:outline-hidden"
                  >
                    {INSIGHT_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {INSIGHT_KIND_LABELS[kind].label}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-ink-muted">
                    {INSIGHT_KIND_LABELS[formKind].description}
                  </span>
                </div>

                {/* Target Tab Analisis */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-caption font-semibold text-ink">
                    Tampil pada Tab Analisis <span className="text-error">*</span>
                  </label>
                  <select
                    value={formTab}
                    onChange={(e) => setFormTab(e.target.value as InsightTab)}
                    className="rounded-button border border-border bg-surface px-3 py-2 text-body text-ink focus:border-primary focus:outline-hidden"
                  >
                    {INSIGHT_TABS.map((tab) => (
                      <option key={tab} value={tab}>
                        {INSIGHT_TAB_LABELS[tab]}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-ink-muted">
                    Pilih &apos;Semua Bagian&apos; agar tampil di semua tab analisis
                  </span>
                </div>
              </div>

              {/* Grid 2 Kolom: Wilayah & Metrik */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Target Wilayah */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-caption font-semibold text-ink">
                    Target Wilayah (Opsional)
                  </label>
                  <select
                    value={formRegionId}
                    onChange={(e) => setFormRegionId(e.target.value)}
                    className="rounded-button border border-border bg-surface px-3 py-2 text-body text-ink focus:border-primary focus:outline-hidden"
                  >
                    <option value="all">Semua Wilayah (Nasional)</option>
                    {regions.map((reg) => (
                      <option key={reg.id} value={reg.id}>
                        {reg.name} ({reg.type.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Target Metrik */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-caption font-semibold text-ink">
                    Target Metrik (Opsional)
                  </label>
                  <select
                    value={formMetric}
                    onChange={(e) => setFormMetric(e.target.value)}
                    className="rounded-button border border-border bg-surface px-3 py-2 text-body text-ink focus:border-primary focus:outline-hidden"
                  >
                    <option value="semua">Semua Metrik</option>
                    <option value="fishingEffort">Aktivitas Penangkapan (Jam)</option>
                    <option value="presence">Keberadaan Kapal (Jam)</option>
                    <option value="viirs">Deteksi Lampu Malam (VIIRS)</option>
                    <option value="sar">Radar Satelit (SAR)</option>
                  </select>
                </div>
              </div>

              {/* Isi Narasi Konten */}
              <div className="flex flex-col gap-1.5">
                <label className="text-caption font-semibold text-ink">
                  Narasi Interpretasi & Temuan <span className="text-error">*</span>
                </label>
                <textarea
                  required
                  rows={5}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Tuliskan analisis ilmiah, faktor penyebab (misal oseanografi/musim), observasi armada kapal di lapangan, atau rekomendasi patroli..."
                  className="w-full rounded-button border border-border bg-surface p-3 text-body text-ink placeholder:text-ink-muted focus:border-primary focus:outline-hidden leading-relaxed"
                />
              </div>

              {/* Status Aktif */}
              <div className="flex items-center gap-2 rounded-card bg-surface/50 p-3 border border-border">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="size-4 rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="isActiveToggle" className="text-caption font-medium text-ink cursor-pointer">
                  Aktifkan langsung di halaman <strong>/analysis</strong> untuk publik
                </label>
              </div>

              {/* Pratinjau Tampilan */}
              <div className="rounded-card border border-border bg-surface/40 p-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted block mb-1.5">
                  Pratinjau Tampilan di /analysis:
                </span>
                <div className="rounded-button border border-blue-200 bg-blue-50/60 p-3 text-caption dark:border-blue-900/40 dark:bg-blue-950/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge tone={INSIGHT_KIND_LABELS[formKind].tone}>
                      {INSIGHT_KIND_LABELS[formKind].label}
                    </Badge>
                    <span className="font-semibold text-ink">
                      {formTitle || "Judul Catatan..."}
                    </span>
                  </div>
                  <p className="text-ink-muted whitespace-pre-line text-[12px] line-clamp-3">
                    {formContent || "Isi narasi catatan akan muncul di sini..."}
                  </p>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="mt-2 flex items-center justify-end gap-3 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Batal
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? "Menyimpan..." : editingInsight ? "Perbarui Catatan" : "Simpan & Publikasikan"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
