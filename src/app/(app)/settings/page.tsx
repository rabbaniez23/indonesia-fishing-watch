import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateView } from "@/components/ui/StateView";
import { can, ROLE_LABELS } from "@/lib/auth/roles";
import { listPendingInvites, listUsers } from "@/lib/auth/service";
import { requireUser } from "@/lib/auth/session";
import { formatDateTimeUTC } from "@/lib/format";
import { InviteForm } from "./InviteForm";
import Link from "next/link";
import { BudgetForm, UserAccessControls } from "@/components/settings/AdminControls";
import { budgetToday } from "@/lib/gfw/http";
import { listRegions } from "@/lib/regions";
import { BUDGET_MAX, BUDGET_MIN } from "@/lib/settings";
import { formatCount } from "@/lib/format";

export const metadata: Metadata = { title: "Pengaturan" };

export default function SettingsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Pengaturan"
        description="Kelola pengguna, batas pemakaian data, dan status sumber. Khusus Admin."
      />
      <Suspense fallback={<StateView state="loading" title="Memuat pengaturan…" />}>
        <SettingsContent />
      </Suspense>
    </PageContainer>
  );
}

async function SettingsContent() {
  const user = await requireUser();
  if (!can(user.role, "user:manage")) {
    return (
      <StateView state="unsupported" title="Khusus Admin">
        Halaman ini hanya dapat dibuka oleh pengguna berperan Admin.
      </StateView>
    );
  }
  const users = listUsers();
  const invites = listPendingInvites();
  const budget = budgetToday();
  const regions = listRegions();
  const tokenConfigured = Boolean(process.env.GFW_API_ACCESS_TOKEN);

  return (
    <>
      <Card>
        <CardHeader
          title="Undang pengguna"
          description="Tautan undangan berlaku 7 hari dan hanya ditampilkan sekali. Kirimkan lewat kanal internal yang aman."
        />
        <InviteForm />
      </Card>

      <Card>
        <CardHeader title="Pengguna" description="Peran menentukan hak baca, membuat temuan, dan mengelola workspace." />
        <DataTable
          caption="Daftar pengguna"
          rows={users}
          rowKey={(row) => row.id}
          total={users.length}
          columns={[
            { key: "name", header: "Nama", cell: (row) => row.name },
            { key: "email", header: "Email", cell: (row) => <span className="break-all">{row.email}</span> },
            { key: "role", header: "Peran", cell: (row) => ROLE_LABELS[row.role] },
            {
              key: "status",
              header: "Status",
              cell: (row) =>
                row.status === "active" ? <Badge tone="success">Aktif</Badge> : <Badge tone="neutral">Nonaktif</Badge>,
            },
            { key: "created", header: "Dibuat", cell: (row) => formatDateTimeUTC(row.createdAt) },
            {
              key: "actions",
              header: "Ubah akses",
              cell: (row) =>
                row.id === user.id ? (
                  <span className="text-caption text-ink-muted">Akun Anda</span>
                ) : (
                  <UserAccessControls userId={row.id} name={row.name} role={row.role} status={row.status} />
                ),
            },
          ]}
        />
        <p className="mt-3 text-caption text-ink-muted">
          Menonaktifkan pengguna mencabut semua sesinya seketika. Minimal satu Admin aktif dipertahankan. Semua perubahan tercatat di audit.
        </p>
      </Card>

      <Card>
        <CardHeader title="Budget request Global Fishing Watch" description="Batas internal aplikasi, lebih rendah dari batas provider. Request yang dilayani cache tidak dihitung." />
        <p className="mb-3 text-ink-muted">
          Hari ini (UTC {budget.day}): <span className="tabular font-semibold text-ink">{formatCount(budget.upstreamRequests)}</span> dari{" "}
          <span className="tabular">{formatCount(budget.limit)}</span> request upstream · {formatCount(budget.cacheHits)} dari cache.
        </p>
        <BudgetForm current={budget.limit} min={BUDGET_MIN} max={BUDGET_MAX} />
      </Card>

      <Card>
        <CardHeader title="Sumber data & token" />
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-[auto_1fr]">
          <dt className="text-ink-muted">Token GFW di server</dt>
          <dd>{tokenConfigured ? "Terpasang (nilai tidak pernah ditampilkan)" : "Belum dipasang — isi GFW_API_ACCESS_TOKEN di lingkungan server"}</dd>
          <dt className="text-ink-muted">Status dataset</dt>
          <dd>
            <Link href="/data-status" className="font-medium text-primary underline underline-offset-2">
              Tentang data
            </Link>{" "}
            · uji akses ulang dengan <code>npm run contract-check</code>
          </dd>
        </dl>
        <p className="mt-3 text-caption text-ink-muted">
          Token tidak dapat diatur dari halaman ini: secret dikelola di konfigurasi server, bukan disimpan di database atau dikirim ke browser.
        </p>
      </Card>

      <Card>
        <CardHeader title="Geometri wilayah" description="Hanya wilayah tervalidasi yang dapat dipakai untuk analisis." />
        <DataTable
          caption="Status geometri"
          rows={[
            ...regions.map((r) => ({
              id: r.id,
              name: r.name,
              status: "Tervalidasi",
              detail: r.gfwRegion ? `Region GFW ${r.gfwRegion.dataset} ${r.gfwRegion.id}` : `${r.source} · ${r.crs}`,
            })),
            ...(regions.some((r) => r.type === "wpp")
              ? []
              : [{ id: "wppnri", name: "WPP-NRI (571–718)", status: "Belum diimpor", detail: "Jalankan npm run regions:import-wpp setelah file Shapefile tersedia." }]),
          ]}
          rowKey={(r) => r.id}
          columns={[
            { key: "n", header: "Wilayah", cell: (r) => r.name },
            { key: "s", header: "Status", cell: (r) => (r.status === "Tervalidasi" ? <Badge tone="success">{r.status}</Badge> : <Badge tone="neutral">{r.status}</Badge>) },
            { key: "d", header: "Keterangan", cell: (r) => <span className="block min-w-[260px] text-caption">{r.detail}</span> },
          ]}
        />
      </Card>

      <Card>
        <CardHeader title="Undangan menunggu" />
        <DataTable
          caption="Undangan yang belum dipakai"
          rows={invites}
          rowKey={(row) => row.id}
          emptyText="Tidak ada undangan yang menunggu."
          columns={[
            { key: "email", header: "Email", cell: (row) => <span className="break-all">{row.email}</span> },
            { key: "role", header: "Peran", cell: (row) => ROLE_LABELS[row.role] },
            { key: "expires", header: "Berlaku sampai", cell: (row) => formatDateTimeUTC(row.expiresAt) },
          ]}
        />
      </Card>
    </>
  );
}
