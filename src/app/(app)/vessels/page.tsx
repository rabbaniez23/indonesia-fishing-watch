import type { Metadata } from "next";
import { FilterBar } from "@/components/filters/FilterBar";
import { RegionNotice } from "@/components/layout/RegionNotice";
import { Suspense } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { ProvenanceDetails } from "@/components/analysis/ProvenanceDetails";
import { ReportLoader } from "@/components/analysis/ReportLoader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateView } from "@/components/ui/StateView";
import type { VesselsResult } from "@/lib/analysis/aggregate";
import { loadPart } from "@/lib/analysis/parts";
import { addDays, defaultFilter, parseFilter, todayUtc, type PeriodFilter } from "@/lib/analysis/period";
import { requireUser } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { searchVessels } from "@/lib/gfw/adapters";
import { GfwError } from "@/lib/gfw/http";
import { formatCount, formatDateRangeUTC, formatDateTimeUTC, formatDateUTC, formatHours } from "@/lib/format";
import { listRegions, type RegionSummary } from "@/lib/regions";
import { summarizeIdentity, typedLabel, type IdentitySummary } from "@/lib/vessels/identity";
import { vesselTypeLabel } from "@/lib/vessels/labels";

export const metadata: Metadata = { title: "Kapal" };

export default function VesselsPage({ searchParams }: PageProps<"/vessels">) {
  return (
    <PageContainer>
      <PageHeader
        title="Kapal"
        description="Daftar kapal yang terlihat di perairan Indonesia. Klik nama kapal untuk melihat profil dan riwayat kegiatannya."
      />
      <Suspense fallback={<StateView state="loading" title="Memuat daftar kapal…" />}>
        <VesselsContent searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}

type ListKind = "fishing" | "all";
const LISTS: Record<ListKind, { tab: string; title: string; dataset: "fishingEffort" | "presence"; valueHeader: string; explain: string }> = {
  fishing: {
    tab: "Kapal penangkap ikan",
    title: "Kapal yang paling lama menangkap ikan",
    dataset: "fishingEffort",
    valueHeader: "Jam menangkap ikan",
    explain: "Diurutkan dari perkiraan jam menangkap ikan terbanyak (dari pola gerak AIS).",
  },
  all: {
    tab: "Semua kapal",
    title: "Kapal yang paling lama berada di wilayah",
    dataset: "presence",
    valueHeader: "Jam di wilayah",
    explain: "Semua jenis kapal ber-AIS (termasuk kargo, penumpang, tunda), diurutkan dari jam keberadaan terbanyak.",
  },
};
const PAGE = 25;

async function VesselsContent({ searchParams }: { searchParams: PageProps<"/vessels">["searchParams"] }) {
  await requireUser();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const since = typeof sp.since === "string" && sp.since.length <= 2000 ? sp.since : null;
  const regions = listRegions().filter((r) => r.analyzable);
  const { filter } = parseFilter(sp, regions.map((r) => r.id));
  const region = regions.find((r) => r.id === filter.regionId) ?? null;

  return (
    <>
      <Card>
        <form method="get" action="/vessels" role="search" className="flex flex-col gap-2">
          <label htmlFor="q" className="font-medium">
            Cari kapal tertentu
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Ketik nama kapal, MMSI, atau IMO"
              minLength={3}
              maxLength={100}
              required
              aria-describedby="q-helper"
              className="h-11 min-w-0 flex-1 rounded-input border border-border-control bg-surface px-3"
            />
            <Button type="submit" icon={<Search className="size-4" aria-hidden />}>
              Cari
            </Button>
          </div>
          <p id="q-helper" className="text-caption text-ink-muted">
            Minimal 3 huruf. Contoh: “BAHARI” atau MMSI 9 digit.
          </p>
        </form>
      </Card>
      {q ? (
        <Results q={q} since={since} />
      ) : region ? (
        <>
          <FilterBar
            regions={regions.map((r) => ({ id: r.id, name: r.name }))}
            applied={{ regionId: filter.regionId, from: filter.from, to: filter.to }}
            defaults={(({ regionId, from, to }) => ({ regionId, from, to }))(defaultFilter(regions[0].id))}
            maxDate={addDays(todayUtc(), -1)}
          />
          <RegionNotice region={region} />
          <VesselList sp={sp} filter={filter} region={region} />
        </>
      ) : (
        <StateView state="gated" title="Belum ada wilayah tervalidasi" />
      )}
    </>
  );
}

function VesselList({ sp, filter, region }: { sp: Record<string, string | string[] | undefined>; filter: PeriodFilter; region: RegionSummary }) {
  const kind: ListKind = sp.list === "all" ? "all" : "fishing";
  const def = LISTS[kind];
  const show = sp.show === "100" ? 100 : sp.show === "50" ? 50 : PAGE;
  const part = loadPart<VesselsResult>(
    { dataset: def.dataset, kind: "vessels", regionId: filter.regionId, start: filter.start, end: filter.end },
    region.geometryHash,
  );
  const base = { region: filter.regionId, from: filter.from, to: filter.to };
  const href = (patch: Record<string, string>) => `/vessels?${new URLSearchParams({ ...base, list: kind, ...patch })}`;
  const profile = (id: string) => `/vessels/${id}?${new URLSearchParams(base)}`;
  const r = part.result?.payload;
  const rows = (r?.topVessels ?? []).slice(0, show).map((v, i) => ({ ...v, rank: i + 1 }));

  return (
    <Card>
      <nav aria-label="Jenis daftar kapal" className="mb-4 inline-flex w-fit flex-wrap rounded-button border border-white/70 bg-white/50 p-1 shadow-[0_0_0_1px_var(--glass-edge)]">
        {(Object.keys(LISTS) as ListKind[]).map((k) => (
          <Link
            key={k}
            href={`/vessels?${new URLSearchParams({ ...base, list: k })}`}
            aria-current={k === kind ? "page" : undefined}
            scroll={false}
            className={cn("inline-flex h-9 items-center rounded-input px-4", k === kind ? "bg-primary font-semibold text-inverse" : "text-ink hover:bg-surface-subtle")}
          >
            {LISTS[k].tab}
          </Link>
        ))}
      </nav>
      <CardHeader
        title={def.title}
        description={`${region.name} · ${formatDateRangeUTC(filter.from, filter.to)} (${filter.days} hari)`}
        info={`${def.explain} Satu kapal bisa punya lebih dari satu identitas AIS. Daftar ini menunjukkan aktivitas, bukan dugaan pelanggaran.`}
      />
      <ReportLoader pending={part.status !== "ready" && !part.error ? [part.params] : []} failed={part.error ? [part.params] : []} total={1} />
      {!r ? (
        part.status === "failed" ? (
          <StateView state="error">Daftar kapal belum bisa diambil ({part.error?.code ?? "galat"}). Coba lagi nanti, atau cari kapal lewat kotak di atas.</StateView>
        ) : (
          <StateView state="loading" title="Mengambil daftar kapal dari Global Fishing Watch…">
            Biasanya kurang dari satu menit. Halaman akan diperbarui otomatis.
          </StateView>
        )
      ) : (
        <div className="flex flex-col gap-3">
          <DataTable
            caption={def.title}
            rows={rows}
            rowKey={(v) => v.vesselId}
            emptyText="Tidak ada kapal tercatat pada periode ini."
            columns={[
              { key: "rank", header: "#", align: "right", cell: (v) => v.rank },
              {
                key: "name",
                header: "Nama kapal",
                cell: (v) => (
                  <Link href={profile(v.vesselId)} className="font-medium whitespace-nowrap text-primary underline underline-offset-2">
                    {v.shipName ?? "Tanpa nama"}
                  </Link>
                ),
              },
              { key: "flag", header: "Bendera", cell: (v) => v.flag ?? <span className="text-ink-muted">Tidak diketahui</span> },
              {
                key: "type",
                header: "Jenis",
                cell: (v) => {
                  const code = v.geartype ?? v.vesselType;
                  return <span title={code ?? undefined}>{vesselTypeLabel(code) ?? <span className="text-ink-muted">Tidak diketahui</span>}</span>;
                },
              },
              { key: "value", header: def.valueHeader, align: "right", cell: (v) => formatHours(v.value) },
              {
                key: "last",
                header: "Terakhir terlihat",
                cell: (v) => <span className="whitespace-nowrap">{v.exitTimestamp ? formatDateUTC(v.exitTimestamp) : "—"}</span>,
              },
              { key: "mmsi", header: "MMSI", cell: (v) => <span className="font-mono text-[13px]">{v.mmsi ?? "—"}</span> },
            ]}
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-caption text-ink-muted">
              Menampilkan {formatCount(rows.length)} teratas dari {formatCount(r.uniqueVesselIds)} kapal yang terlihat.
            </p>
            {show < Math.min(100, r.topVessels.length) ? (
              <Link href={href({ show: String(show === PAGE ? 50 : 100) })} scroll={false} className="font-medium text-primary underline underline-offset-2">
                Tampilkan lebih banyak
              </Link>
            ) : null}
          </div>
          <ProvenanceDetails provenance={part.result!.provenance} summary="Sumber data" />
        </div>
      )}
    </Card>
  );
}

type Candidate = { summary: IdentitySummary; key: string };

async function Results({ q, since }: { q: string; since: string | null }) {
  const clear = (
    <Link href="/vessels" className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2">
      <X className="size-4" aria-hidden />
      Kembali ke daftar kapal
    </Link>
  );
  if (q.length < 3) return <Banner tone="warning" title="Ketik minimal 3 huruf." />;
  let result: Awaited<ReturnType<typeof searchVessels>>;
  try {
    result = await searchVessels({ query: q, since, limit: 20 });
  } catch (error) {
    const code = error instanceof GfwError ? error.code : "UNEXPECTED";
    return <StateView state="error">Pencarian belum bisa dilakukan ({code}). Coba lagi beberapa saat lagi.</StateView>;
  }
  const candidates: Candidate[] = result.candidates.map((identity, i) => ({ summary: summarizeIdentity(identity), key: `${i}` }));
  if (candidates.length === 0) {
    return (
      <StateView state="empty" title={`Tidak ada kapal bernama “${q}”.`}>
        Periksa ejaan, atau coba MMSI (9 digit) atau IMO (7 digit). {clear}
      </StateView>
    );
  }

  return (
    <Card>
      <CardHeader
        title={`Hasil pencarian “${q}”`}
        description={result.total !== null ? `${formatCount(result.total)} kapal cocok` : undefined}
        info="Pencarian mencakup kapal di seluruh dunia. Nama yang sama bisa berarti kapal yang berbeda, jadi cek MMSI dan bendera sebelum membuka profil."
        actions={clear}
      />
      <DataTable
        caption={`Hasil pencarian kapal ${q}`}
        rows={candidates}
        rowKey={(c) => c.key}
        columns={[
          {
            key: "name",
            header: "Nama kapal",
            cell: ({ summary: s }) => (
              <div className="min-w-[160px]">
                <Link href={`/vessels/${s.primaryId}`} className="font-medium text-primary underline underline-offset-2">
                  {s.primary?.shipname ?? "Tanpa nama"}
                </Link>
                {s.others.length > 0 ? <p className="text-caption text-ink-muted">Pernah memakai {s.others.length} identitas AIS lain</p> : null}
              </div>
            ),
          },
          { key: "flag", header: "Bendera", cell: ({ summary: s }) => s.primary?.flag ?? "—" },
          {
            key: "type",
            header: "Jenis",
            cell: ({ summary: s }) => {
              const raw = typedLabel(s.shiptypes);
              return raw ? <span title={raw}>{raw.split(", ").map((c) => vesselTypeLabel(c)).join(", ")}</span> : "—";
            },
          },
          { key: "mmsi", header: "MMSI", cell: ({ summary: s }) => <span className="font-mono text-[13px]">{s.primary?.ssvid ?? "—"}</span> },
          { key: "imo", header: "IMO", cell: ({ summary: s }) => <span className="font-mono text-[13px]">{s.primary?.imo ?? "—"}</span> },
          {
            key: "period",
            header: "Sinyal AIS aktif",
            cell: ({ summary: s }) =>
              s.primary ? (
                <span className="whitespace-nowrap">
                  {formatDateUTC(s.primary.transmissionDateFrom)} – {formatDateUTC(s.primary.transmissionDateTo)}
                </span>
              ) : (
                "—"
              ),
          },
        ]}
      />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {since ? (
          <Link href={`/vessels?q=${encodeURIComponent(q)}`} className="font-medium text-primary underline underline-offset-2">
            Halaman pertama
          </Link>
        ) : null}
        {result.since ? (
          <Link
            href={`/vessels?q=${encodeURIComponent(q)}&since=${encodeURIComponent(result.since)}`}
            className="font-medium text-primary underline underline-offset-2"
          >
            Hasil berikutnya
          </Link>
        ) : null}
      </div>
      <p className="mt-3 text-caption text-ink-muted">
        Data dari Global Fishing Watch · diambil {formatDateTimeUTC(result.fetchedAt)}. Tanggal sinyal terakhir bukan posisi kapal saat ini.
      </p>
    </Card>
  );
}
