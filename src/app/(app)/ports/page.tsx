import type { Metadata } from "next";
import { RegionNotice } from "@/components/layout/RegionNotice";
import { Suspense } from "react";
import { ReportLoader } from "@/components/analysis/ReportLoader";
import { FilterBar } from "@/components/filters/FilterBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { PortsTable } from "@/components/ports/PortsTable";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Card, CardHeader } from "@/components/ui/Card";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateView } from "@/components/ui/StateView";
import { addDays, defaultFilter, parseFilter, todayUtc } from "@/lib/analysis/period";
import { requireUser } from "@/lib/auth/session";
import { formatCount, formatDateRangeUTC, formatDateTimeUTC } from "@/lib/format";
import { loadPortPart, PORT_MAX_DAYS, type PortResult } from "@/lib/ports/port-jobs";
import { listRegions } from "@/lib/regions";

export const metadata: Metadata = { title: "Kunjungan pelabuhan" };

export default function PortsPage({ searchParams }: PageProps<"/ports">) {
  return (
    <PageContainer>
      <PageHeader
        title="Pelabuhan"
        description="Pelabuhan yang paling sering disinggahi kapal. Klik nama pelabuhan untuk melihat kapal yang berkunjung."
        info="Daftar ini disusun dari kunjungan kapal yang tercatat Global Fishing Watch, jadi bukan daftar lengkap seluruh pelabuhan Indonesia. Pelabuhan yang tidak pernah dikunjungi kapal ber-AIS tidak muncul."
      />
      <Suspense fallback={<StateView state="loading" title="Memuat kunjungan pelabuhan…" />}>
        <PortsContent searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}

const COMPLETENESS = { complete: "Lengkap terhadap statistik GFW", partial: "Hasil sebagian", unknown: "Kelengkapan belum diketahui" } as const;

async function PortsContent({ searchParams }: { searchParams: PageProps<"/ports">["searchParams"] }) {
  await requireUser();
  const sp = await searchParams;
  const regions = listRegions().filter((r) => r.analyzable);
  if (regions.length === 0) return <StateView state="gated" title="Belum ada wilayah tervalidasi" />;
  const { filter, error } = parseFilter(sp, regions.map((r) => r.id), new Date(), PORT_MAX_DAYS);
  const region = regions.find((r) => r.id === filter.regionId)!;
  const defaults = defaultFilter(regions[0].id);
  const part = loadPortPart({ type: "port_visits", regionId: filter.regionId, start: filter.start, end: filter.end });
  const result = part.result;
  const pending = part.status !== "ready" && !part.error ? [part.params] : [];
  const failed = part.error ? [part.params] : [];
  const detailQuery = new URLSearchParams({ region: filter.regionId, from: filter.from, to: filter.to }).toString();

  return (
    <>
      <FilterBar
        regions={regions.map((r) => ({ id: r.id, name: r.name }))}
        applied={{ regionId: filter.regionId, from: filter.from, to: filter.to }}
        defaults={{ regionId: defaults.regionId, from: defaults.from, to: defaults.to }}
        maxDate={addDays(todayUtc(), -1)}
        maxDays={PORT_MAX_DAYS}
      />
      {error ? <Banner tone="warning" title={error} /> : null}
      <RegionNotice region={region} />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-button bg-surface-subtle px-4 py-3 text-caption">
        <span>
          <span className="text-ink-muted">Wilayah </span>
          <span className="font-semibold">{region.name}</span>
        </span>
        <span>
          <span className="text-ink-muted">Periode </span>
          <span className="font-semibold">{formatDateRangeUTC(filter.from, filter.to)}</span>
        </span>
        {result ? <Badge tone={result.provenance.completeness === "complete" ? "success" : "warning"}>{COMPLETENESS[result.provenance.completeness]}</Badge> : null}
      </div>

      <ReportLoader pending={pending} failed={failed} total={1} />
      {part.status === "stale" && result ? (
        <Banner tone="warning" title="Menampilkan data tersimpan terakhir; pembaruan belum berhasil.">
          Diambil {formatDateTimeUTC(result.provenance.fetchedAt)}.
        </Banner>
      ) : null}

      <PortKpis result={result} loading={!result && part.status === "pending"} failed={!result && part.status === "failed"} days={filter.days} />

      <Card>
        <CardHeader
          title="Daftar pelabuhan"
          description="Diurutkan dari kunjungan terbanyak. Klik nama pelabuhan untuk melihat kapal yang singgah."
          info="Nama dan negara pelabuhan mengikuti katalog Global Fishing Watch, bukan kode resmi nasional. Informasi kapasitas atau fasilitas pelabuhan tidak tersedia."
        />
        {result ? (
          <PortsTable ports={result.payload.ports} detailQuery={detailQuery} />
        ) : part.status === "failed" ? (
          <StateView state="error">Data kunjungan belum bisa diambil ({part.error?.code}). Coba lagi nanti.</StateView>
        ) : (
          <StateView state="loading" title="Menghitung kunjungan per pelabuhan…">
            Ada puluhan ribu kunjungan per bulan, jadi ini bisa memakan beberapa menit. Halaman akan diperbarui sendiri.
          </StateView>
        )}
      </Card>

      {result ? <PortProvenance result={result} /> : null}
    </>
  );
}

function PortKpis({ result, loading, failed, days }: { result: PortResult | null; loading: boolean; failed: boolean; days: number }) {
  // DS §10.5: KPI hanya ditampilkan bila query lengkap.
  const complete = result?.provenance.completeness === "complete";
  const value = (n: number | undefined) => (result && complete && n !== undefined ? formatCount(n) : null);
  const unknownText = failed
    ? "Data belum bisa diambil."
    : result && !complete
      ? "Belum ditampilkan karena datanya belum lengkap."
      : "Data belum tersedia.";
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
      <MetricCard label="Jumlah kunjungan" info="Kunjungan yang dimulai dalam periode ini, dikenali dari sinyal AIS kapal yang berhenti di pelabuhan. Kunjungan bukan bukti bongkar muat hasil tangkapan." value={value(result?.payload.totalVisits)} unit="kunjungan" period={`${days} hari`} loading={loading} unknownText={unknownText} />
      <MetricCard label="Jumlah kapal" info="Jumlah identitas kapal AIS yang berbeda. Bisa sedikit berbeda dari jumlah kapal sebenarnya karena satu kapal kadang berganti identitas." value={value(result?.payload.totalVessels)} unit="kapal" period={`${days} hari`} loading={loading} unknownText={unknownText} />
      <MetricCard label="Jumlah pelabuhan" info="Hanya pelabuhan yang dikunjungi kapal ber-AIS selama periode ini." value={value(result?.payload.portCount)} unit="pelabuhan" period={`${days} hari`} loading={loading} unknownText={unknownText} />
    </div>
  );
}

function PortProvenance({ result }: { result: PortResult }) {
  const p = result.provenance;
  return (
    <Card>
      <CardHeader as="h2" title="Sumber data" />
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-caption sm:grid-cols-[auto_1fr]">
        <dt className="text-ink-muted">Sumber</dt>
        <dd>Global Fishing Watch · {p.datasetResolved ?? p.datasetRequested}</dd>
        <dt className="text-ink-muted">Diambil pada</dt>
        <dd>{formatDateTimeUTC(p.fetchedAt)}</dd>
        <dt className="text-ink-muted">Angka resmi GFW</dt>
        <dd>
          {result.stats?.numEvents !== null && result.stats?.numEvents !== undefined
            ? `${formatCount(result.stats.numEvents)} kunjungan · ${formatCount(result.stats.numVessels)} kapal`
            : "Tidak tersedia"}
        </dd>
        <dt className="text-ink-muted">Dihitung aplikasi</dt>
        <dd>
          {formatCount(result.payload.totalVisits)} kunjungan · {formatCount(result.payload.totalVessels)} ID kapal · {formatCount(p.rowCount)} baris dibaca
        </dd>
        <dt className="text-ink-muted">Kelengkapan</dt>
        <dd>{COMPLETENESS[p.completeness]}</dd>
        <dt className="text-ink-muted">Catatan</dt>
        <dd>
          <ul className="list-disc pl-4">
            {p.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
            <li>Kunjungan pelabuhan bukan bukti bongkar muat hasil tangkapan.</li>
          </ul>
        </dd>
      </dl>
    </Card>
  );
}
