import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { PageContainer } from "@/components/layout/PageContainer";
import { AdminOnly } from "@/components/cms/AdminOnly";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateView } from "@/components/ui/StateView";
import { can } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { getActivityStats, listActivities } from "@/lib/cms/activity";
import { listArticles } from "@/lib/cms/articles";
import { listResearchDatasets } from "@/lib/cms/datasets";
import { listCustomLayers } from "@/lib/cms/layers";
import { CATEGORY_LABELS } from "@/lib/cms/types";
import { formatCount, formatDateTimeUTC } from "@/lib/format";

export const metadata: Metadata = { title: "Ikhtisar CMS" };

export default function CmsOverviewPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Ikhtisar CMS"
        description="Kelola dataset riset, lapisan peta, artikel, dan catatan analisis yang dilihat semua pengguna. Khusus Admin."
      />
      <Suspense fallback={<StateView state="loading" title="Memuat ringkasan CMS…" />}>
        <Content />
      </Suspense>
    </PageContainer>
  );
}

async function Content() {
  const user = await requireUser();
  if (!can(user.role, "cms:manage")) return <AdminOnly />;

  const datasets = listResearchDatasets();
  const layers = listCustomLayers();
  const articles = listArticles();
  const published = articles.filter((a) => a.status === "published").length;
  const stats = getActivityStats();
  const recent = listActivities({ pageSize: 5 }).items;
  // Menu CMS lain (selain halaman ini) sebagai pintasan, diambil dari sidebar agar selalu sama.
  const shortcuts = NAV_ITEMS.filter((item) => item.group === "kelola" && item.href !== "/cms");

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Dataset riset" value={formatCount(datasets.length)} unit="file" period={`${formatCount(datasets.filter((d) => d.summary.hasCoordinates).length)} berkoordinat`} />
        <MetricCard label="Lapisan peta" value={formatCount(layers.length)} unit="lapisan" period={`${formatCount(layers.filter((l) => l.isVisible).length)} tampil di Peta`} />
        <MetricCard label="Artikel" value={formatCount(articles.length)} unit="tulisan" period={`${formatCount(published)} diterbitkan`} />
        <MetricCard label="Aktivitas tim" value={formatCount(stats.total30Days)} unit="tindakan" period={`30 hari terakhir · ${formatCount(stats.totalToday)} hari ini (UTC)`} />
      </div>

      <Card>
        <CardHeader title="Kelola" />
        <ul className="grid gap-1 md:grid-cols-2">
          {shortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link href={item.href} className="group flex items-start gap-3 rounded-button p-2 hover:bg-surface-subtle">
                  <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-button bg-primary-soft text-primary">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink group-hover:text-primary">{item.label}</span>
                    <span className="block text-caption text-ink-muted">{item.description}</span>
                  </span>
                  <ChevronRight className="mt-2 size-4 shrink-0 text-ink-muted" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Dataset terbaru"
            actions={
              <Link href="/cms/data" className="font-medium text-primary underline underline-offset-2">
                Semua dataset
              </Link>
            }
          />
          <DataTable
            caption="Lima dataset riset terakhir"
            rows={datasets.slice(0, 5)}
            rowKey={(d) => d.id}
            emptyText="Belum ada dataset yang diunggah."
            columns={[
              { key: "n", header: "Nama", cell: (d) => <span className="font-medium">{d.name}</span> },
              { key: "k", header: "Kategori", cell: (d) => <Badge tone="neutral">{CATEGORY_LABELS[d.category] ?? d.category}</Badge> },
              { key: "r", header: "Baris", align: "right", cell: (d) => formatCount(d.rowCount) },
              { key: "t", header: "Diunggah", cell: (d) => <span className="text-caption">{formatDateTimeUTC(d.createdAt)}</span> },
            ]}
          />
        </Card>
        <Card>
          <CardHeader
            title="Aktivitas tim terakhir"
            actions={
              <Link href="/cms/activity" className="font-medium text-primary underline underline-offset-2">
                Log lengkap
              </Link>
            }
          />
          <DataTable
            caption="Lima tindakan terakhir"
            rows={recent}
            rowKey={(a) => a.id}
            emptyText="Belum ada aktivitas tercatat."
            columns={[
              { key: "s", header: "Oleh", cell: (a) => a.actorName },
              { key: "a", header: "Tindakan", cell: (a) => <Badge tone="info">{a.actionLabel}</Badge> },
              { key: "t", header: "Waktu", cell: (a) => <span className="text-caption">{formatDateTimeUTC(a.occurredAt)}</span> },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
