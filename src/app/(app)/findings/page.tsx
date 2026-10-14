import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { FindingPriorityBadge, FindingStatusBadge } from "@/components/findings/FindingBadges";
import { SaveFindingButton } from "@/components/findings/SaveFindingButton";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateView } from "@/components/ui/StateView";
import { defaultFilter } from "@/lib/analysis/period";
import { can } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { STATUS_LABEL, STATUSES, sourceLabel, type FindingStatus } from "@/lib/findings/model";
import { countFindingsByStatus, listFindings } from "@/lib/findings/service";
import { cn } from "@/lib/cn";
import { formatCount, formatDateRangeUTC, formatDateTimeUTC } from "@/lib/format";
import { listRegions } from "@/lib/regions";

export const metadata: Metadata = { title: "Temuan" };

export default function FindingsPage({ searchParams }: PageProps<"/findings">) {
  return (
    <PageContainer>
      <Suspense fallback={<StateView state="loading" title="Memuat temuan…" />}>
        <Findings searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}

async function Findings({ searchParams }: { searchParams: PageProps<"/findings">["searchParams"] }) {
  const user = await requireUser();
  const sp = await searchParams;
  const status = typeof sp.status === "string" && (STATUSES as readonly string[]).includes(sp.status) ? (sp.status as FindingStatus) : undefined;
  const canCreate = can(user.role, "finding:create");
  const findings = listFindings(status ? { status } : {});
  const counts = countFindingsByStatus();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const region = listRegions()[0];
  const filter = defaultFilter(region?.id ?? "");

  return (
    <>
      <PageHeader
        title="Temuan"
        description="Catatan tim tentang aktivitas yang perlu ditinjau. Buat temuan dari peta atau profil kapal, lalu perbarui statusnya di sini."
        info="Status “Selesai” berarti peninjauan sudah selesai — bukan pernyataan bahwa kapal legal atau ilegal."
        actions={
          <SaveFindingButton
            source={{ type: "manual" }}
            filter={{ regionId: filter.regionId, from: filter.from, to: filter.to }}
            canCreate={canCreate}
            label="Buat temuan"
            variant="primary"
          />
        }
      />

      <nav aria-label="Filter status temuan" className="flex flex-wrap gap-2">
        {[undefined, ...STATUSES].map((s) => {
          const active = s === status;
          return (
            <Link
              key={s ?? "semua"}
              href={s ? `/findings?status=${s}` : "/findings"}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-full border px-3",
                active ? "border-primary bg-primary-soft font-semibold text-primary" : "border-border-control bg-surface hover:bg-surface-subtle",
              )}
            >
              {s ? STATUS_LABEL[s] : "Semua"}
              <span className="tabular text-caption text-ink-muted">{formatCount(s ? counts[s] : total)}</span>
            </Link>
          );
        })}
      </nav>

      <Card>
        {findings.length === 0 ? (
          <StateView state="empty" title={status ? `Belum ada temuan berstatus ${STATUS_LABEL[status].toLowerCase()}.` : "Belum ada temuan."}>
            {canCreate
              ? "Simpan temuan dari sel peta, profil kapal, kejadian, atau tombol Buat temuan."
              : "Analyst atau Admin dapat menyimpan temuan; peran Anda hanya dapat membaca."}
          </StateView>
        ) : (
          <DataTable
            caption="Daftar temuan"
            rows={findings}
            rowKey={(f) => f.id}
            total={status ? counts[status] : total}
            columns={[
              {
                key: "title",
                header: "Judul",
                cell: (f) => (
                  <Link href={`/findings/${f.id}`} className="block min-w-[200px] font-medium text-primary underline underline-offset-2">
                    {f.title}
                  </Link>
                ),
              },
              { key: "priority", header: "Prioritas", cell: (f) => <FindingPriorityBadge priority={f.priority} /> },
              { key: "status", header: "Status", cell: (f) => <FindingStatusBadge status={f.status} /> },
              { key: "source", header: "Sumber", cell: (f) => sourceLabel({ type: f.sourceType } as never) },
              { key: "period", header: "Konteks periode", cell: (f) => <span className="whitespace-nowrap text-caption">{formatDateRangeUTC(f.filter.from, f.filter.to)}</span> },
              { key: "by", header: "Pembuat", cell: (f) => f.createdBy.name },
              { key: "updated", header: "Diperbarui", cell: (f) => <span className="whitespace-nowrap">{formatDateTimeUTC(f.updatedAt)}</span> },
            ]}
          />
        )}
      </Card>
    </>
  );
}
