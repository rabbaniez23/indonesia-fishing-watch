import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, Ship } from "lucide-react";
import { FilterBar } from "@/components/filters/FilterBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { StateView } from "@/components/ui/StateView";
import { Tabs } from "@/components/ui/Tabs";
import { VesselEvents } from "@/components/vessels/VesselEvents";
import { addDays, defaultFilter, parseFilter, todayUtc } from "@/lib/analysis/period";
import { can } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { SaveFindingButton } from "@/components/findings/SaveFindingButton";
import { getVessel, isValidVesselId } from "@/lib/gfw/adapters";
import { GfwError } from "@/lib/gfw/http";
import type { SelfReportedIdentity } from "@/lib/gfw/schemas";
import { formatCount, formatDateTimeUTC, formatDateUTC } from "@/lib/format";
import { listRegions } from "@/lib/regions";
import { summarizeIdentity, type TypedValue } from "@/lib/vessels/identity";
import { vesselTypeLabel } from "@/lib/vessels/labels";

export const metadata: Metadata = { title: "Profil kapal" };

export default function VesselProfilePage({ params, searchParams }: PageProps<"/vessels/[id]">) {
  return (
    <PageContainer>
      <Suspense fallback={<StateView state="loading" title="Memuat profil kapal…" />}>
        <Profile params={params} searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}

const na = <span className="text-ink-muted">Tidak tersedia</span>;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

function identityPeriod(s: SelfReportedIdentity) {
  return `${formatDateUTC(s.transmissionDateFrom)} – ${formatDateUTC(s.transmissionDateTo)}`;
}

async function Profile({ params, searchParams }: { params: PageProps<"/vessels/[id]">["params"]; searchParams: PageProps<"/vessels/[id]">["searchParams"] }) {
  const user = await requireUser();
  const canCreate = can(user.role, "finding:create");
  const { id } = await params;
  const sp = await searchParams;
  if (!isValidVesselId(id)) return <StateView state="error" title="ID kapal tidak valid." />;

  let result: Awaited<ReturnType<typeof getVessel>>;
  try {
    result = await getVessel(id);
  } catch (error) {
    if (error instanceof GfwError && error.code === "NOT_FOUND") {
      return <StateView state="empty" title="Kapal tidak ditemukan di data Global Fishing Watch." />;
    }
    return <StateView state="error">Profil belum dapat dimuat dari sumber ({error instanceof GfwError ? error.code : "galat"}).</StateView>;
  }

  const identity = result.identity;
  const s = summarizeIdentity(identity, id);
  const p = s.primary;
  const regions = listRegions().filter((r) => r.analyzable);
  const { filter } = parseFilter(sp, regions.map((r) => r.id));
  const defaults = defaultFilter(regions[0]?.id ?? "");
  const name = p?.shipname ?? "Nama tidak tersedia";

  const identityTab = (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-6">
      <Card>
        <CardHeader as="h3" title="Identitas kapal" description="Data yang dipancarkan kapal sendiri lewat AIS." info="Karena diisi sendiri oleh awak kapal, data ini bisa berubah atau keliru dari waktu ke waktu." />
        {p ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <Field label="Nama">{p.shipname ?? na}</Field>
            <Field label="MMSI">{p.ssvid ? <span className="font-mono text-[13px]">{p.ssvid}</span> : na}</Field>
            <Field label="IMO">{p.imo ? <span className="font-mono text-[13px]">{p.imo}</span> : na}</Field>
            <Field label="Tanda panggil">{p.callsign ?? na}</Field>
            <Field label="Bendera kapal">{p.flag ?? na}</Field>
            <Field label="Sinyal AIS aktif">{identityPeriod(p)}</Field>
            <Field label="Sumber">{p.sourceCode.length ? p.sourceCode.join(", ") : na}</Field>
            <Field label="ID di GFW">
              <span className="font-mono text-caption break-all">{p.id}</span>
            </Field>
          </dl>
        ) : (
          <StateView state="unknown" title="Tidak ada identitas AIS untuk ID ini." />
        )}
        <p className="mt-3 text-caption text-ink-muted">Tanggal sinyal terakhir bukan posisi kapal saat ini.</p>
      </Card>

      <Card>
        <CardHeader as="h3" title="Jenis kapal & alat tangkap" description="Menurut catatan registri dan perkiraan model Global Fishing Watch." />
        <TypedTable label="Jenis kapal" values={s.shiptypes} />
        <div className="mt-4" />
        <TypedTable label="Alat tangkap" values={s.geartypes} />
      </Card>

      <Card>
        <CardHeader as="h3" title="Registry" />
        {s.registryShown > 0 ? (
          <DataTable
            caption="Record registry"
            rows={identity.registryInfo.map((r, i) => ({ ...r, i }))}
            rowKey={(r) => String(r.i)}
            columns={[
              { key: "n", header: "Nama", cell: (r) => r.shipname ?? "Tidak tersedia" },
              { key: "f", header: "Bendera", cell: (r) => r.flag ?? "Tidak tersedia" },
              { key: "imo", header: "IMO", cell: (r) => r.imo ?? "Tidak tersedia" },
              { key: "p", header: "Periode", cell: (r) => `${formatDateUTC(r.transmissionDateFrom)} – ${formatDateUTC(r.transmissionDateTo)}` },
            ]}
          />
        ) : (s.registryCount ?? 0) > 0 ? (
          <StateView state="unsupported" title={`Tercatat ${formatCount(s.registryCount)} record registry di GFW`} className="py-6">
            Detail record tidak dikembalikan untuk akses token workspace ini, sehingga tidak ditampilkan.
          </StateView>
        ) : (
          <StateView state="empty" title="Tidak ada record registry dalam data GFW untuk kapal ini." className="py-6" />
        )}
        <p className="mt-3 text-caption text-ink-muted">
          Pemilik, izin, dan foto hanya ditampilkan bila tersedia dari sumber; tidak dibuat dari data lain.
          {identity.registryOwners.length === 0 ? " Data pemilik: tidak tersedia." : ""}
        </p>
      </Card>

      <Card>
        <CardHeader
          as="h3"
          title="Identitas lain yang pernah dipakai"
          description="Global Fishing Watch menduga identitas ini milik kapal yang sama. Masing-masing ditampilkan terpisah dengan periodenya."
        />
        <DataTable
          caption="Identitas AIS lain"
          rows={s.others}
          rowKey={(o) => o.id}
          emptyText="Tidak ada identitas AIS lain."
          columns={[
            {
              key: "n",
              header: "Nama",
              cell: (o) => (
                <Link href={`/vessels/${o.id}`} className="font-medium text-primary underline underline-offset-2">
                  {o.shipname ?? "Tidak tersedia"}
                </Link>
              ),
            },
            { key: "m", header: "MMSI", cell: (o) => <span className="font-mono text-[13px]">{o.ssvid ?? "—"}</span> },
            { key: "f", header: "Bendera", cell: (o) => o.flag ?? "—" },
            { key: "p", header: "Periode transmisi", cell: (o) => <span className="whitespace-nowrap">{identityPeriod(o)}</span> },
          ]}
        />
      </Card>
    </div>
  );

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-caption text-ink-muted">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/vessels" className="text-primary underline underline-offset-2">
              Kapal
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight className="size-3.5" />
          </li>
          <li aria-current="page">{name}</li>
        </ol>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-button bg-primary-soft text-primary" aria-hidden>
            <Ship className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-[24px] leading-[32px] font-semibold break-words sm:text-page-title">{name}</h1>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-ink-muted">
              <span>
                MMSI <span className="font-mono text-ink">{p?.ssvid ?? "—"}</span>
              </span>
              <span>
                IMO <span className="font-mono text-ink">{p?.imo ?? "—"}</span>
              </span>
              <span>Bendera {p?.flag ?? "tidak diketahui"}</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {s.sources.map((src) => (
                <Badge key={src} tone="info">
                  Identitas dari {src}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <SaveFindingButton
          canCreate={canCreate}
          filter={{ regionId: filter.regionId, from: filter.from, to: filter.to }}
          defaultTitle={`Tinjau kapal ${name}`}
          source={{
            type: "vessel",
            vesselId: id,
            name: p?.shipname ?? null,
            mmsi: p?.ssvid ?? null,
            imo: p?.imo ?? null,
            flag: p?.flag ?? null,
            datasetResolved: result.datasetResolved,
            fetchedAt: result.fetchedAt,
          }}
        />
      </header>

      <Card>
        <CardHeader
          as="h2"
          title="Periode riwayat"
          description="Riwayat kegiatan di tab Aktivitas dan Kunjungan pelabuhan mengikuti wilayah dan tanggal ini."
          actions={
            canCreate ? (
              <Link
                href={`/reports?${new URLSearchParams({ new: "kejadian_kapal", vesselId: id, from: filter.from, to: filter.to })}`}
                className="font-medium text-primary underline underline-offset-2"
              >
                Unduh riwayat (CSV)
              </Link>
            ) : undefined
          }
        />
        <FilterBar
          regions={regions.map((r) => ({ id: r.id, name: r.name }))}
          applied={{ regionId: filter.regionId, from: filter.from, to: filter.to }}
          defaults={{ regionId: defaults.regionId, from: defaults.from, to: defaults.to }}
          maxDate={addDays(todayUtc(), -1)}
        />
      </Card>

      <Tabs
        label="Profil kapal"
        tabs={[
          { id: "identitas", label: "Identitas", content: identityTab },
          {
            id: "aktivitas",
            label: "Aktivitas",
            content: <VesselEvents vesselId={id} kinds={["fishing", "encounter", "loitering"]} filter={filter} canCreate={canCreate} />,
          },
          {
            id: "kunjungan",
            label: "Kunjungan pelabuhan",
            content: <VesselEvents vesselId={id} kinds={["port_visit"]} filter={filter} canCreate={canCreate} />,
          },
        ]}
      />

      <p className="text-caption text-ink-muted">
        Sumber identitas: Global Fishing Watch · {result.datasetResolved ?? "versi belum diketahui"} · diambil {formatDateTimeUTC(result.fetchedAt)}.
        Bendera = bendera kapal, bukan kewarganegaraan pemilik. Profil tidak menyatakan legalitas kapal.
      </p>
    </>
  );
}

function TypedTable({ label, values }: { label: string; values: TypedValue[] }) {
  return (
    <DataTable
      caption={label}
      rows={values.map((v, i) => ({ ...v, i }))}
      rowKey={(v) => String(v.i)}
      emptyText={`${label}: tidak tersedia.`}
      columns={[
        { key: "n", header: label, cell: (v) => <span title={v.name}>{vesselTypeLabel(v.name)}</span> },
        { key: "y", header: "Tahun", cell: (v) => `${v.yearFrom ?? "?"}–${v.yearTo ?? "?"}` },
        { key: "s", header: "Sumber", cell: (v) => <span className="text-caption break-words">{v.source ?? "—"}</span> },
      ]}
    />
  );
}
