import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Database,
  FileCheck,
  FileText,
  FolderUp,
  History,
  Layers,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { formatCount, formatDateTimeUTC } from "@/lib/format";
import { listResearchDatasets } from "@/lib/cms/datasets";
import { listCustomLayers } from "@/lib/cms/layers";
import { listArticles } from "@/lib/cms/articles";
import { listAnalysisInsights } from "@/lib/cms/analysis-insights";
import { getActivityStats, listActivities } from "@/lib/cms/activity";
import { CATEGORY_LABELS } from "@/lib/cms/types";

export const metadata: Metadata = {
  title: "Ikhtisar CMS",
};

export default function CmsOverviewPage() {
  const datasets = listResearchDatasets();
  const layers = listCustomLayers();
  const articles = listArticles();
  const activityStats = getActivityStats();
  const recentActivities = listActivities({ pageSize: 5 }).items;

  const totalDatasets = datasets.length;
  const spatialDatasets = datasets.filter((d) => d.summary.hasCoordinates).length;
  const totalRows = datasets.reduce((acc, curr) => acc + (curr.rowCount || 0), 0);
  const recentDatasets = datasets.slice(0, 5);

  return (
    <div className="flex flex-col gap-8">
      {/* Welcome Banner */}
      <div className="glass-card flex flex-col justify-between gap-6 rounded-card border border-border p-6 shadow-xs sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1.5 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-button bg-primary-soft px-2.5 py-1 text-caption font-semibold text-primary">
              <Sparkles className="size-3.5" />
              Ruang Kerja Peneliti & Pengelola
            </span>
          </div>
          <h1 className="text-page-title font-semibold text-ink">Panel Pengelola Riset (CMS)</h1>
          <p className="text-body text-ink-muted leading-relaxed">
            Kelola data pengamatan maritim, lapisan peta baru, artikel publikasi, dan pantau log aktivitas tim secara mandiri.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/cms/data"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-button bg-primary px-5 font-medium text-inverse shadow-xs transition-colors hover:bg-primary-hover"
          >
            <FolderUp className="size-4" />
            <span>Mulai Unggah Data</span>
          </Link>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card flex flex-col justify-between rounded-card border border-border p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-caption font-semibold uppercase tracking-wider text-ink-muted">
              Total Dataset Riset
            </span>
            <div className="flex size-9 items-center justify-center rounded-button bg-primary-soft text-primary">
              <Database className="size-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="tabular text-3xl font-bold text-ink">{formatCount(totalDatasets)}</span>
            <p className="mt-1 text-caption text-ink-muted">file CSV & GeoJSON tersimpan</p>
          </div>
        </div>

        <div className="glass-card flex flex-col justify-between rounded-card border border-border p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-caption font-semibold uppercase tracking-wider text-ink-muted">
              Lapisan Peta Kustom
            </span>
            <div className="flex size-9 items-center justify-center rounded-button bg-emerald-50 text-[#166534]">
              <Layers className="size-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="tabular text-3xl font-bold text-ink">{formatCount(layers.length)}</span>
            <p className="mt-1 text-caption text-ink-muted">layer aktif di peta MapLibre</p>
          </div>
        </div>

        <div className="glass-card flex flex-col justify-between rounded-card border border-border p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-caption font-semibold uppercase tracking-wider text-ink-muted">
              Artikel & Buletin
            </span>
            <div className="flex size-9 items-center justify-center rounded-button bg-purple-50 text-purple-700">
              <FileText className="size-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="tabular text-3xl font-bold text-ink">{formatCount(articles.length)}</span>
            <p className="mt-1 text-caption text-ink-muted">konten dokumentasi & riset</p>
          </div>
        </div>

        <div className="glass-card flex flex-col justify-between rounded-card border border-border p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-caption font-semibold uppercase tracking-wider text-ink-muted">
              Aktivitas Tim (30 Hari)
            </span>
            <div className="flex size-9 items-center justify-center rounded-button bg-blue-50 text-blue-700">
              <Activity className="size-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="tabular text-3xl font-bold text-ink">{formatCount(activityStats.total30Days)}</span>
            <p className="mt-1 text-caption text-ink-muted">{formatCount(activityStats.totalToday)} aksi hari ini (UTC)</p>
          </div>
        </div>
      </div>

      {/* 4 Action / Feature Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card flex flex-col justify-between rounded-card border border-border p-6 shadow-xs">
          <div className="flex flex-col gap-2">
            <div className="flex size-10 items-center justify-center rounded-card bg-primary-soft text-primary">
              <Database className="size-5" />
            </div>
            <h3 className="text-section-title font-semibold text-ink">Data & Observasi</h3>
            <p className="text-caption text-ink-muted leading-relaxed">
              Unggah file data pengamatan kapal lapangan (CSV), citra satelit VIIRS, atau survei oseanografi baru.
            </p>
          </div>
          <div className="mt-4">
            <Link
              href="/cms/data"
              className="inline-flex items-center gap-1.5 text-caption font-semibold text-primary hover:underline"
            >
              <span>Buka Portal Data</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>

        <div className="glass-card flex flex-col justify-between rounded-card border border-border p-6 shadow-xs">
          <div className="flex flex-col gap-2">
            <div className="flex size-10 items-center justify-center rounded-card bg-emerald-50 text-[#166534]">
              <Layers className="size-5" />
            </div>
            <h3 className="text-section-title font-semibold text-ink">Lapisan Peta Kustom</h3>
            <p className="text-caption text-ink-muted leading-relaxed">
              Konfigurasi layer batas konservasi, jalur penangkapan, atau zona patroli langsung ke peta pemantauan.
            </p>
          </div>
          <div className="mt-4">
            <Link
              href="/cms/layers"
              className="inline-flex items-center gap-1.5 text-caption font-semibold text-primary hover:underline"
            >
              <span>Kelola Lapisan Peta</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>

        <div className="glass-card flex flex-col justify-between rounded-card border border-border p-6 shadow-xs">
          <div className="flex flex-col gap-2">
            <div className="flex size-10 items-center justify-center rounded-card bg-purple-50 text-purple-700">
              <TrendingUp className="size-5" />
            </div>
            <h3 className="text-section-title font-semibold text-ink">Catatan Analisis (/analysis)</h3>
            <p className="text-caption text-ink-muted leading-relaxed">
              Kelola narasi interpretasi tren musiman, temuan lapangan, dan catatan kritis pada halaman statistik aktivitas.
            </p>
          </div>
          <div className="mt-4">
            <Link
              href="/cms/analysis"
              className="inline-flex items-center gap-1.5 text-caption font-semibold text-primary hover:underline"
            >
              <span>Kelola Catatan Analisis</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>

        <div className="glass-card flex flex-col justify-between rounded-card border border-border p-6 shadow-xs">
          <div className="flex flex-col gap-2">
            <div className="flex size-10 items-center justify-center rounded-card bg-blue-50 text-blue-700">
              <History className="size-5" />
            </div>
            <h3 className="text-section-title font-semibold text-ink">Log Audit Aktivitas</h3>
            <p className="text-caption text-ink-muted leading-relaxed">
              Pantau audit seluruh tindakan tim, tren aktivitas 14 hari terakhir, dan ekspor riwayat operasional ke CSV.
            </p>
          </div>
          <div className="mt-4">
            <Link
              href="/cms/activity"
              className="inline-flex items-center gap-1.5 text-caption font-semibold text-primary hover:underline"
            >
              <span>Buka Log Audit</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* 2 Tables: Recent Datasets & Recent Activity Log */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Recent Datasets */}
        <Card>
          <div className="flex items-center justify-between border-b border-border p-5">
            <div>
              <h2 className="text-section-title font-semibold text-ink">Dataset Terbaru</h2>
              <p className="text-caption text-ink-muted">Aktivitas unggahan dataset riset terakhir</p>
            </div>
            <Link
              href="/cms/data"
              className="inline-flex items-center gap-1 text-caption font-semibold text-primary hover:underline"
            >
              <span>Semua Dataset</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>

          {recentDatasets.length === 0 ? (
            <div className="p-8 text-center text-ink-muted">
              <p className="text-caption">Belum ada dataset yang diunggah.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentDatasets.map((d) => (
                <div key={d.id} className="flex flex-col gap-1.5 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink text-caption truncate">{d.name}</span>
                    <Badge tone="neutral">{CATEGORY_LABELS[d.category] || d.category}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-ink-muted">
                    <span className="font-mono">{formatCount(d.rowCount)} baris</span>
                    <span>{formatDateTimeUTC(d.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Right: Recent Activities Audit */}
        <Card>
          <div className="flex items-center justify-between border-b border-border p-5">
            <div>
              <h2 className="text-section-title font-semibold text-ink">Aktivitas Tim Terkini</h2>
              <p className="text-caption text-ink-muted">Tindakan operasional dan sistem terbaru</p>
            </div>
            <Link
              href="/cms/activity"
              className="inline-flex items-center gap-1 text-caption font-semibold text-primary hover:underline"
            >
              <span>Lihat Audit Penuh</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>

          {recentActivities.length === 0 ? (
            <div className="p-8 text-center text-ink-muted">
              <p className="text-caption">Belum ada log aktivitas tercatat.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentActivities.map((act) => (
                <div key={act.id} className="flex flex-col gap-1.5 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[10px] font-bold text-primary">
                        {act.actorName.charAt(0).toUpperCase()}
                      </span>
                      <span className="font-semibold text-ink text-caption truncate">{act.actorName}</span>
                    </div>
                    <Badge tone="info">{act.actionLabel}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-ink-muted">
                    <span className="font-mono">{act.entityType}</span>
                    <span>{formatDateTimeUTC(act.occurredAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
