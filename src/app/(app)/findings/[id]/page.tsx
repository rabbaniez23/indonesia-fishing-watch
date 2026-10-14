import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { FindingActions } from "@/components/findings/FindingActions";
import { FindingPriorityBadge, FindingStatusBadge } from "@/components/findings/FindingBadges";
import { SourcePreview } from "@/components/findings/SaveFindingButton";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardHeader } from "@/components/ui/Card";
import { StateView } from "@/components/ui/StateView";
import { can } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { PRIORITY_LABEL, STATUS_LABEL, type FindingPriority, type FindingSource, type FindingStatus } from "@/lib/findings/model";
import { getFinding, type FindingNote } from "@/lib/findings/service";
import { formatDateTimeUTC } from "@/lib/format";

export const metadata: Metadata = { title: "Detail temuan" };

export default function FindingDetailPage({ params }: PageProps<"/findings/[id]">) {
  return (
    <PageContainer>
      <Suspense fallback={<StateView state="loading" title="Memuat temuan…" />}>
        <Detail params={params} />
      </Suspense>
    </PageContainer>
  );
}

function sourceHref(source: FindingSource, filter: { regionId: string; from: string; to: string }): string | null {
  const q = new URLSearchParams({ region: filter.regionId, from: filter.from, to: filter.to });
  if (source.type === "cell") {
    q.set("layer", source.layer);
    q.set("cell", `${source.lat},${source.lon}`);
    return `/map?${q}`;
  }
  if (source.type === "vessel") return `/vessels/${source.vesselId}?${q}`;
  if (source.type === "event") return `/vessels/${source.vesselId}?${q}`;
  return null;
}

function noteText(n: FindingNote) {
  if (n.kind === "status" && n.fromValue && n.toValue) {
    return `Status: ${STATUS_LABEL[n.fromValue as FindingStatus]} → ${STATUS_LABEL[n.toValue as FindingStatus]}`;
  }
  if (n.kind === "prioritas" && n.fromValue && n.toValue) {
    return `Prioritas: ${PRIORITY_LABEL[n.fromValue as FindingPriority]} → ${PRIORITY_LABEL[n.toValue as FindingPriority]}`;
  }
  return n.kind === "dibuat" ? "Dibuat" : "Catatan";
}

async function Detail({ params }: { params: PageProps<"/findings/[id]">["params"] }) {
  const user = await requireUser();
  const { id } = await params;
  const finding = getFinding(id);
  if (!finding) return <StateView state="empty" title="Temuan tidak ditemukan." />;
  const href = sourceHref(finding.source, finding.filter);

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-caption text-ink-muted">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/findings" className="text-primary underline underline-offset-2">
              Temuan
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight className="size-3.5" />
          </li>
          <li aria-current="page" className="break-words">
            {finding.title}
          </li>
        </ol>
      </nav>
      <header className="flex flex-col gap-2">
        <h1 className="text-[24px] leading-[32px] font-semibold break-words sm:text-page-title">{finding.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <FindingStatusBadge status={finding.status} />
          <FindingPriorityBadge priority={finding.priority} />
          <span className="text-caption text-ink-muted">
            Dibuat {finding.createdBy.name} · {formatDateTimeUTC(finding.createdAt)} · diperbarui {finding.updatedBy.name} ·{" "}
            {formatDateTimeUTC(finding.updatedAt)} · versi {finding.version}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-4 md:gap-6 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-4 md:gap-6 xl:col-span-7">
          <Card>
            <CardHeader as="h2" title="Alasan" />
            <p className="whitespace-pre-wrap break-words">{finding.reason}</p>
            <p className="mt-3 text-caption text-ink-muted">
              <span className="font-medium text-ink">Alasan prioritas:</span> {finding.priorityReason}
            </p>
          </Card>
          <Card>
            <CardHeader as="h2" title="Sumber (snapshot)" description="Disimpan saat temuan dibuat dan tidak berubah walau data provider diperbarui." />
            <SourcePreview source={finding.source} filter={finding.filter} />
            {href ? (
              <Link href={href} className="mt-3 inline-block font-medium text-primary underline underline-offset-2">
                Buka sumber dengan konteks yang sama
              </Link>
            ) : null}
          </Card>
          <Card>
            <CardHeader as="h2" title="Riwayat & catatan" description="Append-only: tidak ada catatan yang diubah atau dihapus." />
            <ol className="flex flex-col gap-3">
              {finding.notes.map((n) => (
                <li key={n.id} className="rounded-input border border-border p-3">
                  <p className="text-caption text-ink-muted">
                    <span className="font-medium text-ink">{noteText(n)}</span> · {n.actor.name} · {formatDateTimeUTC(n.createdAt)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words">{n.body}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <Card className="xl:col-span-5">
          <CardHeader as="h2" title="Tindakan peninjauan" description="“Selesai” berarti peninjauan selesai; tidak menyatakan kapal legal atau ilegal." />
          <FindingActions
            id={finding.id}
            status={finding.status}
            priority={finding.priority}
            version={finding.version}
            canEdit={can(user.role, "finding:update")}
          />
        </Card>
      </div>
    </>
  );
}
