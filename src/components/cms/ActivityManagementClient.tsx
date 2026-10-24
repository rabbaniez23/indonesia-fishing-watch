"use client";

import { useState } from "react";
import {
  Activity,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Eye,
  FileText,
  Filter,
  History,
  Info,
  Layers,
  Search,
  Settings,
  Shield,
  Sparkles,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { Badge, type StatusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatCount, formatDateTimeUTC } from "@/lib/format";
import type {
  ActivityCategory,
  ActivityEntry,
  ActivityStats,
  PaginatedActivities,
} from "@/lib/cms/types";
import { ACTIVITY_CATEGORIES, ACTIVITY_CATEGORY_LABELS } from "@/lib/cms/types";

type Props = {
  initialData: PaginatedActivities;
  initialStats: ActivityStats;
};

export function ActivityManagementClient({ initialData, initialStats }: Props) {
  const [data, setData] = useState<PaginatedActivities>(initialData);
  const [stats, setStats] = useState<ActivityStats>(initialStats);
  const [category, setCategory] = useState<ActivityCategory>("all");
  const [timeRange, setTimeRange] = useState<"all" | "today" | "7d" | "30d">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [detailEntry, setDetailEntry] = useState<ActivityEntry | null>(null);

  // Fetch updated data from API
  async function loadData(
    cat = category,
    range = timeRange,
    q = search,
    p = page,
  ) {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (cat !== "all") params.set("category", cat);
      if (range !== "all") params.set("timeRange", range);
      if (q.trim()) params.set("search", q.trim());
      params.set("page", String(p));
      params.set("pageSize", "20");

      const res = await fetch(`/api/cms/activity?${params.toString()}`);
      const json = await res.json();
      if (json.ok && json.data) {
        setData(json.data);
        if (json.stats) {
          setStats(json.stats);
        }
      }
    } catch (err) {
      console.error("Gagal memuat log aktivitas:", err);
    } finally {
      setIsLoading(false);
    }
  }

  function handleCategoryChange(newCat: ActivityCategory) {
    setCategory(newCat);
    setPage(1);
    loadData(newCat, timeRange, search, 1);
  }

  function handleTimeRangeChange(newRange: "all" | "today" | "7d" | "30d") {
    setTimeRange(newRange);
    setPage(1);
    loadData(category, newRange, search, 1);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    loadData(category, timeRange, search, 1);
  }

  function handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > data.totalPages) return;
    setPage(newPage);
    loadData(category, timeRange, search, newPage);
  }

  function handleExportCsv() {
    setIsExporting(true);
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (timeRange !== "all") params.set("timeRange", timeRange);
    if (search.trim()) params.set("search", search.trim());

    const url = `/api/cms/activity/export?${params.toString()}`;
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `aktivitas-cms-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExporting(false);
  }

  // Get action tone and icon for badges
  function getActionBadgeProps(action: string, cat: string): { tone: StatusTone; label: string } {
    if (action.includes("delete") || action.includes("revoke")) {
      return { tone: "error", label: "Hapus / Cabut" };
    }
    if (action.includes("login") || action.includes("accept")) {
      return { tone: "success", label: "Sukses" };
    }
    if (action.includes("finding") || action.includes("warning")) {
      return { tone: "warning", label: "Observasi" };
    }
    if (cat === "dataset" || cat === "layer" || cat === "article") {
      return { tone: "info", label: "Konten Riset" };
    }
    return { tone: "neutral", label: "Sistem" };
  }

  // Max value in daily trends for bar scaling
  const maxTrendCount = Math.max(1, ...stats.dailyTrends.map((t) => t.count));
  const topUser = stats.topContributors[0];

  return (
    <div className="flex flex-col gap-8">
      {/* Header Banner */}
      <div className="glass-card flex flex-col justify-between gap-6 rounded-card border border-border p-6 shadow-xs sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1.5 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-button bg-primary-soft px-2.5 py-1 text-caption font-semibold text-primary">
              <History className="size-3.5" />
              Audit & Observabilitas Tim
            </span>
          </div>
          <h1 className="text-page-title font-semibold text-ink">Statistik & Log Aktivitas</h1>
          <p className="text-body text-ink-muted leading-relaxed">
            Pantau seluruh aktivitas penambahan dataset riset, pembaruan lapisan peta, publikasi artikel,
            dan interaksi sistem secara transparan dan terperinci.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Button
            variant="secondary"
            onClick={handleExportCsv}
            disabled={isExporting}
            className="flex items-center gap-2"
          >
            <Download className="size-4" />
            <span>{isExporting ? "Mengunduh..." : "Ekspor Log (CSV)"}</span>
          </Button>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total 30 Hari */}
        <div className="glass-card flex flex-col justify-between rounded-card border border-border p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-caption font-semibold uppercase tracking-wider text-ink-muted">
              Total Aktivitas (30 Hari)
            </span>
            <div className="flex size-9 items-center justify-center rounded-button bg-primary-soft text-primary">
              <Activity className="size-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="tabular text-3xl font-bold text-ink">
              {formatCount(stats.total30Days)}
            </span>
            <p className="mt-1 text-caption text-ink-muted">aksi audit sistem tercatat</p>
          </div>
        </div>

        {/* Card 2: Hari Ini */}
        <div className="glass-card flex flex-col justify-between rounded-card border border-border p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-caption font-semibold uppercase tracking-wider text-ink-muted">
              Aktivitas Hari Ini (UTC)
            </span>
            <div className="flex size-9 items-center justify-center rounded-button bg-emerald-50 text-[#166534]">
              <Calendar className="size-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="tabular text-3xl font-bold text-ink">
              {formatCount(stats.totalToday)}
            </span>
            <p className="mt-1 text-caption text-ink-muted">event operasional hari ini</p>
          </div>
        </div>

        {/* Card 3: Aksi Riset & Konten */}
        <div className="glass-card flex flex-col justify-between rounded-card border border-border p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-caption font-semibold uppercase tracking-wider text-ink-muted">
              Aksi Riset & Konten
            </span>
            <div className="flex size-9 items-center justify-center rounded-button bg-blue-50 text-blue-700">
              <Database className="size-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="tabular text-3xl font-bold text-ink">
              {formatCount(stats.researchActionsCount)}
            </span>
            <p className="mt-1 text-caption text-ink-muted">unggah data, layer & artikel</p>
          </div>
        </div>

        {/* Card 4: Kontributor Teraktif */}
        <div className="glass-card flex flex-col justify-between rounded-card border border-border p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-caption font-semibold uppercase tracking-wider text-ink-muted">
              Kontributor Teraktif
            </span>
            <div className="flex size-9 items-center justify-center rounded-button bg-amber-50 text-amber-700">
              <UserCheck className="size-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="truncate text-xl font-bold text-ink block">
              {topUser ? topUser.name : "Belum Ada"}
            </span>
            <p className="mt-1 text-caption text-ink-muted">
              {topUser ? `${formatCount(topUser.count)} tindakan (30 hari)` : "Aktivitas tim akan muncul"}
            </p>
          </div>
        </div>
      </div>

      {/* Visual Chart & Distribution Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: 14-day Activity Trend Bar Chart (2 cols) */}
        <div className="glass-card flex flex-col justify-between rounded-card border border-border p-6 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h2 className="text-section-title font-semibold text-ink">Tren Aktivitas 14 Hari Terakhir</h2>
              <p className="text-caption text-ink-muted">Distribusi frekuensi tindakan tim per hari (UTC)</p>
            </div>
            <span className="rounded-button bg-surface px-2.5 py-1 text-caption font-mono text-ink-muted border border-border">
              Maks: {formatCount(maxTrendCount)} aksi/hari
            </span>
          </div>

          {/* Bar Chart Canvas */}
          <div className="mt-6 flex h-48 items-end gap-2 pt-4">
            {stats.dailyTrends.map((trend) => {
              const heightPercent = maxTrendCount > 0 ? (trend.count / maxTrendCount) * 100 : 0;
              const hasActivity = trend.count > 0;

              return (
                <div
                  key={trend.date}
                  className="group relative flex flex-1 flex-col items-center h-full justify-end"
                >
                  {/* Tooltip on Hover */}
                  <div className="pointer-events-none absolute -top-10 z-20 hidden rounded-md bg-ink px-2 py-1 text-[11px] font-medium text-inverse shadow-md group-hover:block whitespace-nowrap">
                    {trend.label}: <span className="font-bold">{trend.count} aksi</span>
                  </div>

                  {/* Value Above Bar */}
                  {hasActivity && (
                    <span className="mb-1 text-[10px] font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      {trend.count}
                    </span>
                  )}

                  {/* Bar */}
                  <div
                    style={{ height: `${Math.max(4, heightPercent)}%` }}
                    className={`w-full rounded-t-sm transition-all duration-300 ${
                      hasActivity
                        ? "bg-primary hover:bg-primary-hover shadow-xs"
                        : "bg-surface-hover/50"
                    }`}
                  />

                  {/* Date Label */}
                  <span className="mt-2 text-[10px] text-ink-muted rotate-45 sm:rotate-0 origin-left text-center">
                    {trend.label.split(" ")[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Category Distribution (1 col) */}
        <div className="glass-card flex flex-col justify-between rounded-card border border-border p-6 shadow-xs">
          <div>
            <h2 className="text-section-title font-semibold text-ink">Distribusi Kategori</h2>
            <p className="text-caption text-ink-muted">Porsi aktivitas berdasarkan modul</p>

            <div className="mt-5 flex flex-col gap-3">
              {stats.categoryBreakdown.map((cat) => {
                const getCategoryIcon = () => {
                  switch (cat.category) {
                    case "dataset":
                      return <Database className="size-4 text-emerald-600" />;
                    case "layer":
                      return <Layers className="size-4 text-blue-600" />;
                    case "article":
                      return <FileText className="size-4 text-purple-600" />;
                    case "auth":
                      return <Shield className="size-4 text-amber-600" />;
                    default:
                      return <Settings className="size-4 text-gray-600" />;
                  }
                };

                return (
                  <div key={cat.category} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-caption font-medium">
                      <div className="flex items-center gap-1.5 text-ink">
                        {getCategoryIcon()}
                        <span>{cat.label}</span>
                      </div>
                      <span className="tabular text-ink-muted font-mono">
                        {cat.count} ({cat.percentage}%)
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="h-2 w-full rounded-full bg-surface-hover overflow-hidden">
                      <div
                        style={{ width: `${cat.percentage}%` }}
                        className="h-full rounded-full bg-primary"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Contributors list */}
          {stats.topContributors.length > 0 && (
            <div className="mt-6 border-t border-border pt-4">
              <span className="text-caption font-semibold uppercase tracking-wider text-ink-muted block mb-2">
                Kontributor Teratas
              </span>
              <div className="flex flex-col gap-2">
                {stats.topContributors.slice(0, 3).map((u, i) => (
                  <div key={u.actorId} className="flex items-center justify-between text-caption">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary-soft text-[10px] font-bold text-primary">
                        {i + 1}
                      </span>
                      <span className="truncate font-medium text-ink">{u.name}</span>
                    </div>
                    <span className="tabular text-ink-muted font-mono shrink-0">
                      {u.count} aksi
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter and Table Section */}
      <Card>
        {/* Filter Controls Header */}
        <div className="border-b border-border p-6 flex flex-col gap-4">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-section-title font-semibold text-ink">Daftar Log Aktivitas</h2>
              <p className="text-body text-ink-muted">
                Riwayat kronologis semua tindakan operasional CMS & sistem
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-caption text-ink-muted">
                Total: <strong className="text-ink">{formatCount(data.total)}</strong> tindakan
              </span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            {/* Search Box */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari aktor, aksi, nama berkas, atau payload..."
                className="w-full rounded-button border border-border bg-surface pl-9 pr-4 py-2 text-body text-ink placeholder:text-ink-muted focus:border-primary focus:outline-hidden"
              />
            </form>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Category Filter */}
              <div className="flex items-center gap-1.5">
                <Filter className="size-4 text-ink-muted" />
                <select
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value as ActivityCategory)}
                  className="rounded-button border border-border bg-surface px-3 py-2 text-caption font-medium text-ink focus:border-primary focus:outline-hidden"
                >
                  {ACTIVITY_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {ACTIVITY_CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Time Range Filter */}
              <div className="flex items-center gap-1.5">
                <Calendar className="size-4 text-ink-muted" />
                <select
                  value={timeRange}
                  onChange={(e) =>
                    handleTimeRangeChange(e.target.value as "all" | "today" | "7d" | "30d")
                  }
                  className="rounded-button border border-border bg-surface px-3 py-2 text-caption font-medium text-ink focus:border-primary focus:outline-hidden"
                >
                  <option value="all">Semua Waktu</option>
                  <option value="today">Hari Ini (24 Jam)</option>
                  <option value="7d">7 Hari Terakhir</option>
                  <option value="30d">30 Hari Terakhir</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Activities Table */}
        {isLoading ? (
          <div className="p-12 text-center text-ink-muted">
            <div className="inline-block size-6 animate-spin rounded-full border-2 border-primary border-t-transparent mb-2" />
            <p>Memuat log aktivitas...</p>
          </div>
        ) : data.items.length === 0 ? (
          <div className="p-12 text-center text-ink-muted">
            <Info className="mx-auto size-8 text-ink-muted mb-2" />
            <p className="font-medium text-ink">Tidak ada log aktivitas ditemukan</p>
            <p className="text-caption mt-1">Coba sesuaikan kata kunci pencarian atau filter kategori.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface/50 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  <th className="py-3 px-4">Waktu (UTC)</th>
                  <th className="py-3 px-4">Aktor / Pengguna</th>
                  <th className="py-3 px-4">Kategori & Aksi</th>
                  <th className="py-3 px-4">Entitas Terkait</th>
                  <th className="py-3 px-4 text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-body">
                {data.items.map((item) => {
                  const badge = getActionBadgeProps(item.action, item.category);

                  return (
                    <tr key={item.id} className="hover:bg-surface/50 transition-colors">
                      {/* Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-mono text-caption text-ink font-medium">
                            {formatDateTimeUTC(item.occurredAt)}
                          </span>
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-caption font-bold text-primary">
                            {item.actorName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-ink truncate text-caption">
                              {item.actorName}
                            </span>
                            {item.actorEmail && (
                              <span className="text-[11px] text-ink-muted truncate">
                                {item.actorEmail}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category & Action */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <Badge tone={badge.tone}>{item.actionLabel}</Badge>
                          <span className="text-[11px] text-ink-muted">
                            {item.categoryLabel} ({item.action})
                          </span>
                        </div>
                      </td>

                      {/* Entity */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col font-mono text-caption">
                          <span className="text-ink font-medium">{item.entityType}</span>
                          {item.entityId && (
                            <span className="text-[11px] text-ink-muted truncate max-w-[180px]">
                              ID: {item.entityId}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {item.changes ? (
                          <Button
                            variant="secondary"
                            size="compact"
                            onClick={() => setDetailEntry(item)}
                            className="inline-flex items-center gap-1.5 text-caption h-8 px-2.5"
                          >
                            <Eye className="size-3.5" />
                            <span>Perubahan</span>
                          </Button>
                        ) : (
                          <span className="text-[11px] text-ink-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border p-4">
            <span className="text-caption text-ink-muted">
              Halaman <strong className="text-ink">{data.page}</strong> dari{" "}
              <strong className="text-ink">{data.totalPages}</strong>
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="compact"
                onClick={() => handlePageChange(data.page - 1)}
                disabled={data.page <= 1 || isLoading}
                className="flex items-center gap-1"
              >
                <ChevronLeft className="size-4" />
                <span>Sebelumnya</span>
              </Button>
              <Button
                variant="secondary"
                size="compact"
                onClick={() => handlePageChange(data.page + 1)}
                disabled={data.page >= data.totalPages || isLoading}
                className="flex items-center gap-1"
              >
                <span>Berikutnya</span>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Modal Detail Perubahan */}
      {detailEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="glass-card flex max-h-[85vh] w-full max-w-xl flex-col rounded-card border border-border shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border p-5">
              <div className="flex items-center gap-2">
                <Info className="size-5 text-primary" />
                <h3 className="text-section-title font-semibold text-ink">Rincian Perubahan Aksi</h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailEntry(null)}
                className="rounded-button p-1 text-ink-muted hover:bg-surface hover:text-ink"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="mb-4 flex flex-col gap-1 rounded-card bg-surface/50 p-3 border border-border text-caption">
                <div className="flex justify-between">
                  <span className="text-ink-muted">Aksi:</span>
                  <span className="font-semibold text-ink">{detailEntry.actionLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Aktor:</span>
                  <span className="font-semibold text-ink">{detailEntry.actorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Waktu:</span>
                  <span className="font-mono text-ink">{formatDateTimeUTC(detailEntry.occurredAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Entitas:</span>
                  <span className="font-mono text-ink">{detailEntry.entityType} ({detailEntry.entityId || "-"})</span>
                </div>
              </div>

              <h4 className="text-caption font-semibold uppercase tracking-wider text-ink-muted mb-2">
                Payload / Properti yang Berubah
              </h4>

              {detailEntry.changes ? (
                <div className="rounded-card border border-border bg-surface divide-y divide-border overflow-hidden">
                  {Object.entries(detailEntry.changes).map(([key, val]) => (
                    <div key={key} className="flex flex-col p-3 sm:flex-row sm:items-center sm:justify-between gap-1 text-caption">
                      <span className="font-mono font-semibold text-ink-muted">{key}</span>
                      <span className="font-mono text-ink text-left sm:text-right break-all">
                        {typeof val === "object" ? JSON.stringify(val, null, 2) : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-caption text-ink-muted italic">Tidak ada payload perubahan tercatat.</p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-border p-4 text-right">
              <Button variant="secondary" onClick={() => setDetailEntry(null)}>
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
