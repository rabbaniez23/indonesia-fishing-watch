import type { Metadata } from "next";
import { DataGuide } from "@/components/layout/DataGuide";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge, type StatusTone } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateView } from "@/components/ui/StateView";
import { can } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { getDataStatus, type DatasetStatus } from "@/lib/data-status";
import { formatCount, formatDateTimeUTC } from "@/lib/format";

export const metadata: Metadata = { title: "Data Global Fishing Watch" };

export default function DataStatusPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Data Global Fishing Watch"
        description="Dataset GFW yang dipakai menu Ringkasan, Peta, Kapal, Pelabuhan, dan Statistik aktivitas: status koneksi, seberapa baru, dan batasannya. Baca ini sebelum menarik kesimpulan dari angka di aplikasi."
      />
      <Suspense fallback={<StateView state="loading" title="Memuat status sumber…" />}>
        <DataStatusContent />
      </Suspense>
    </PageContainer>
  );
}

const ACCESS: Record<DatasetStatus["accessStatus"], { tone: StatusTone; label: string }> = {
  ok: { tone: "success", label: "Teruji akses" },
  error: { tone: "error", label: "Gagal diakses" },
  unsupported: { tone: "neutral", label: "Tidak tersedia lewat akses ini" },
  untested: { tone: "neutral", label: "Belum diuji" },
};

const FAMILY_LABEL: Record<DatasetStatus["family"], string> = {
  "4wings": "4Wings (grid)",
  events: "Events",
  vessels: "Vessels",
  regions: "Regions",
};

async function DataStatusContent() {
  const user = await requireUser();
  const isAdmin = can(user.role, "dataset:manage");
  const status = getDataStatus({ includeErrorDetail: isAdmin });
  const tested = status.datasets.filter((d) => d.accessStatus === "ok").length;
  const failing = status.datasets.filter((d) => d.accessStatus === "error");

  return (
    <>
      <DataGuide />
      <h2 className="mt-2 text-section-title font-semibold">Status teknis sumber data</h2>
      {!status.tokenConfigured ? (
        <Banner tone="error" title="Token GFW belum dipasang di server.">
          Admin perlu mengisi <code>GFW_API_ACCESS_TOKEN</code> di lingkungan server. Tidak ada data yang diambil.
        </Banner>
      ) : !status.connected ? (
        <Banner tone="warning" title="Belum ada request terautentikasi yang berhasil.">
          Jalankan contract check (<code>npm run contract-check</code>) untuk menguji akses.
        </Banner>
      ) : null}
      {failing.length > 0 ? (
        <Banner tone="error" title={`${failing.length} dataset gagal diakses pada pemeriksaan terakhir.`}>
          Fitur yang bergantung pada dataset tersebut menampilkan state error, bukan nilai nol.
        </Banner>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        <Card>
          <h2 className="text-card-title font-semibold text-ink-muted">Koneksi Global Fishing Watch</h2>
          <div className="mt-3">
            {status.connected ? (
              <Badge tone="success">Tersambung</Badge>
            ) : status.tokenConfigured ? (
              <Badge tone="neutral">Belum teruji</Badge>
            ) : (
              <Badge tone="error">Token belum dipasang</Badge>
            )}
          </div>
          <p className="mt-3 text-caption text-ink-muted">
            {tested} dari {status.datasets.length} dataset teruji akses. “Tersambung” hanya setelah request terautentikasi berhasil.
          </p>
        </Card>
        <Card>
          <h2 className="text-card-title font-semibold text-ink-muted">Budget request hari ini</h2>
          <p className="tabular mt-2 text-metric-mobile font-semibold">
            {formatCount(status.budget.upstreamRequests)}
            <span className="text-body font-normal text-ink-muted"> / {formatCount(status.budget.limit)}</span>
          </p>
          <p className="text-caption text-ink-muted">
            Request upstream · hari UTC {status.budget.day} · {formatCount(status.budget.cacheHits)} dilayani dari cache
          </p>
        </Card>
        <Card>
          <h2 className="text-card-title font-semibold text-ink-muted">Cakupan wilayah</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {status.regions.length > 0 ? (
              <Badge tone="success">{status.regions.length} wilayah tervalidasi</Badge>
            ) : (
              <Badge tone="neutral">Belum ada wilayah</Badge>
            )}
            {status.regions.some((r) => r.type === "wpp") ? (
              <Badge tone="neutral">{status.regions.filter((r) => r.type === "wpp").length} WPP</Badge>
            ) : (
              <Badge tone="neutral">WPP belum diimpor</Badge>
            )}
          </div>
          <p className="mt-3 text-caption text-ink-muted">
            Batas WPP berasal dari file Shapefile yang diimpor dan disederhanakan (±555 m); dikirim ke GFW sebagai poligon.
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Dataset"
          description="“Didukung dokumentasi” berasal dari dokumentasi GFW; “Teruji akses” berarti request nyata dengan token workspace berhasil."
        />
        <DataTable
          caption="Status dataset Global Fishing Watch"
          rows={status.datasets}
          rowKey={(row) => row.alias}
          columns={[
            {
              key: "label",
              header: "Dataset",
              cell: (row) => (
                <div className="min-w-[260px] max-w-[380px]">
                  <p className="font-medium">{row.label}</p>
                  <p className="font-mono text-caption break-all text-ink-muted">{row.alias}</p>
                  {row.notes ? <p className="mt-1 text-caption text-ink-muted">{row.notes}</p> : null}
                  {row.lastErrorCode ? (
                    <p className="mt-1 text-caption text-error">
                      Error terakhir: {row.lastErrorCode}
                      {isAdmin && row.lastErrorDetail ? ` — ${row.lastErrorDetail}` : ""}
                    </p>
                  ) : null}
                </div>
              ),
            },
            { key: "family", header: "API", cell: (row) => FAMILY_LABEL[row.family] },
            {
              key: "priority",
              header: "Rilis",
              cell: (row) => (row.priority === "P0" ? "MVP" : <Badge tone="neutral">Lanjutan (P1)</Badge>),
            },
            { key: "doc", header: "Didukung dokumentasi", cell: (row) => (row.docSupported ? "Ya" : "Tidak") },
            {
              key: "access",
              header: "Teruji akses",
              cell: (row) => <Badge tone={ACCESS[row.accessStatus].tone}>{ACCESS[row.accessStatus].label}</Badge>,
            },
            {
              key: "version",
              header: "Versi dilayani",
              // Hanya bagian versi (mis. v4.0); alias lengkap sudah ada di kolom Dataset.
              cell: (row) =>
                row.resolvedVersion ? (
                  <span className="font-mono text-caption whitespace-nowrap">{row.resolvedVersion.split(":")[1] ?? row.resolvedVersion}</span>
                ) : (
                  <span className="text-ink-muted">Belum diketahui</span>
                ),
            },
            {
              key: "success",
              header: "Fetch berhasil terakhir",
              cell: (row) =>
                row.lastSuccessAt ? (
                  <span className="whitespace-nowrap">{formatDateTimeUTC(row.lastSuccessAt)}</span>
                ) : (
                  <span className="text-ink-muted">Belum ada</span>
                ),
            },
          ]}
        />
      </Card>

      <Card>
        <CardHeader title="Wilayah cakupan" description="Geometri yang dipakai untuk membatasi aktivitas pada Indonesia." />
        <DataTable
          caption="Wilayah cakupan tervalidasi"
          rows={status.regions}
          rowKey={(row) => row.id}
          emptyText="Belum ada wilayah tervalidasi. Jalankan npm run regions:import."
          columns={[
            {
              key: "name",
              header: "Wilayah",
              cell: (row) => (
                <div className="min-w-[180px]">
                  <p className="font-medium">{row.name}</p>
                  <p className="text-caption text-ink-muted">
                    {row.gfwRegion ? `GFW ${row.gfwRegion.dataset} · id ${row.gfwRegion.id}` : row.analyzable ? "Poligon dikirim ke GFW" : "Tanpa region GFW"}
                  </p>
                </div>
              ),
            },
            { key: "source", header: "Sumber", cell: (row) => <span className="block min-w-[240px] text-caption">{row.source}</span> },
            { key: "crs", header: "CRS", cell: (row) => row.crs },
            {
              key: "hash",
              header: "Hash geometri",
              cell: (row) => <span className="font-mono text-caption" title={row.geometryHash}>{row.geometryHash.slice(0, 12)}…</span>,
            },
            { key: "validated", header: "Divalidasi", cell: (row) => formatDateTimeUTC(row.validatedAt) },
            { key: "notes", header: "Catatan", cell: (row) => <span className="block min-w-[240px] text-caption text-ink-muted">{row.notes}</span> },
          ]}
        />
      </Card>

      <Card>
        <CardHeader title="Ketersediaan & waktu data" />
        <dl className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <dt className="font-medium">Data tersedia sampai (menurut provider)</dt>
            <dd className="mt-1 text-ink-muted">
              Belum diketahui. Respons report GFW yang diuji tidak menyertakan metadata ketersediaan, sehingga kelengkapan
              setiap hasil ditandai “belum diketahui”.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Keterlambatan menurut dokumentasi</dt>
            <dd className="mt-1 text-ink-muted">
              AIS (apparent fishing, keberadaan) sampai sekitar 96 jam; deteksi radar SAR sampai sekitar 5 hari. Ini pernyataan
              dokumentasi, bukan jaminan kelengkapan.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Waktu yang dibedakan</dt>
            <dd className="mt-1 text-ink-muted">
              “Diambil pada” (fetch aplikasi), “Observasi terakhir dalam hasil”, dan “Data tersedia sampai” (provider) ditampilkan
              terpisah pada setiap hasil.
            </dd>
          </div>
        </dl>
      </Card>

      <p className="text-caption text-ink-muted">
        <a href="https://globalfishingwatch.org" target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-2">
          Powered by Global Fishing Watch.
        </a>{" "}
        Penggunaan nonkomersial sesuai lisensi GFW. Batas wilayah ZEE berasal dari layer region GFW (Marine Regions).
      </p>
    </>
  );
}
