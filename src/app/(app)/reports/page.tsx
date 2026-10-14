import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { AutoRefresh } from "@/components/reports/AutoRefresh";
import { CreateReportDialog } from "@/components/reports/CreateReportDialog";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge, type StatusTone } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateView } from "@/components/ui/StateView";
import { addDays, defaultFilter, todayUtc } from "@/lib/analysis/period";
import { can } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { formatCount, formatDateRangeUTC, formatDateTimeUTC } from "@/lib/format";
import { MAP_LAYERS } from "@/lib/map/layers";
import { REPORT_STATUS_LABEL, REPORT_TYPE_LABEL, REPORT_TYPES, type ReportStatus, type ReportType } from "@/lib/reports/model";
import { listReports, type ReportRecord } from "@/lib/reports/service";
import { listRegions } from "@/lib/regions";

export const metadata: Metadata = { title: "Laporan" };

export default function ReportsPage({ searchParams }: PageProps<"/reports">) {
  return (
    <PageContainer>
      <Suspense fallback={<StateView state="loading" title="Memuat laporan…" />}>
        <Reports searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}

const STATUS_TONE: Record<ReportStatus, StatusTone> = { antre: "neutral", diproses: "info", siap: "success", gagal: "error" };
const COMPLETENESS: Record<string, string> = { complete: "Lengkap", partial: "Sebagian", unknown: "Belum diketahui" };

function sizeLabel(bytes: number | null) {
  if (bytes === null) return "—";
  return bytes < 1024 * 1024 ? `${formatCount(Math.ceil(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function paramsLabel(r: ReportRecord) {
  const p = r.params;
  const base = formatDateRangeUTC(p.from, p.to);
  if (p.type === "sel_grid") return `${MAP_LAYERS[p.layer].metricLabel} · ${base}`;
  if (p.type === "kejadian_kapal") return `Kapal ${p.vesselId.slice(0, 12)}… · ${p.kinds.join(", ")} · ${base}`;
  return base;
}

async function Reports({ searchParams }: { searchParams: PageProps<"/reports">["searchParams"] }) {
  const user = await requireUser();
  const sp = await searchParams;
  const reports = listReports();
  const regions = listRegions().filter((r) => r.analyzable);
  const defaults = defaultFilter(regions[0]?.id ?? "");
  const active = reports.some((r) => r.status === "antre" || r.status === "diproses");
  const initialType = typeof sp.new === "string" && (REPORT_TYPES as readonly string[]).includes(sp.new) ? (sp.new as ReportType) : undefined;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);

  return (
    <>
      <PageHeader
        title="Laporan"
        description="Unduh data sebagai file CSV yang bisa dibuka di Excel atau Google Sheets. File tersimpan selama 7 hari."
        info="Setiap file menyertakan keterangan sumber, periode (UTC), satuan, dan batasan data, supaya angkanya tidak disalahartikan saat dibagikan."
        actions={
          <CreateReportDialog
            canCreate={can(user.role, "report:create")}
            regions={regions.map((r) => ({ id: r.id, name: r.name }))}
            defaults={{ regionId: defaults.regionId, from: defaults.from, to: defaults.to }}
            maxDate={addDays(todayUtc(), -1)}
            initial={initialType ? { type: initialType, vesselId: str(sp.vesselId), from: str(sp.from), to: str(sp.to), open: true } : undefined}
          />
        }
      />
      <AutoRefresh active={active} />
      <p className="text-caption text-ink-muted">
        Tampilan cetak:{" "}
        <Link href={`/print/ringkasan?region=${defaults.regionId}&from=${defaults.from}&to=${defaults.to}`} className="font-medium text-primary underline underline-offset-2">
          Ringkasan siap cetak
        </Link>{" "}
        (memakai snapshot Ringkasan yang sudah dimuat).
      </p>
      <div aria-live="polite" className="sr-only">
        {active ? "Ada laporan yang sedang diproses; daftar diperbarui otomatis." : ""}
      </div>
      <Card>
        {reports.length === 0 ? (
          <StateView state="empty" title="Belum ada laporan." />
        ) : (
          <DataTable
            caption="Daftar laporan"
            rows={reports}
            rowKey={(r) => r.id}
            columns={[
              {
                key: "type",
                header: "Laporan",
                cell: (r) => (
                  <div className="min-w-[220px]">
                    <p className="font-medium">{REPORT_TYPE_LABEL[r.type]}</p>
                    <p className="text-caption text-ink-muted">{paramsLabel(r)}</p>
                  </div>
                ),
              },
              {
                key: "status",
                header: "Status",
                cell: (r) => (
                  <div className="flex min-w-[140px] flex-col items-start gap-1">
                    <Badge tone={STATUS_TONE[r.status]} icon={r.status === "diproses" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : undefined}>
                      {REPORT_STATUS_LABEL[r.status]}
                    </Badge>
                    {r.status === "antre" ? <span className="text-caption text-ink-muted">Menunggu giliran.</span> : null}
                    {r.status === "gagal" ? <span className="text-caption text-error">{r.errorMessage ?? r.errorCode}</span> : null}
                  </div>
                ),
              },
              { key: "rows", header: "Baris", align: "right", cell: (r) => (r.rowCount === null ? "—" : formatCount(r.rowCount)) },
              { key: "comp", header: "Kelengkapan", cell: (r) => (r.completeness ? COMPLETENESS[r.completeness] ?? r.completeness : "—") },
              {
                key: "by",
                header: "Dibuat",
                cell: (r) => (
                  <div className="min-w-[150px] text-caption">
                    <p>{r.createdBy.name}</p>
                    <p className="text-ink-muted">{formatDateTimeUTC(r.createdAt)}</p>
                  </div>
                ),
              },
              {
                key: "dl",
                header: "Unduh",
                cell: (r) => {
                  if (r.status !== "siap") return <span className="text-caption text-ink-muted">Belum tersedia</span>;
                  if (r.expired) return <span className="text-caption text-ink-muted">Kedaluwarsa</span>;
                  return (
                    <div className="flex min-w-[170px] flex-col gap-1">
                      <a href={`/api/reports/${r.id}/download`} className={buttonClasses("secondary", "compact")} download>
                        Unduh ZIP
                      </a>
                      <span className="text-caption text-ink-muted" id={`meta-${r.id}`}>
                        {sizeLabel(r.fileSize)} · berlaku sampai {formatDateTimeUTC(r.expiresAt)}
                      </span>
                    </div>
                  );
                },
              },
            ]}
          />
        )}
      </Card>
    </>
  );
}
