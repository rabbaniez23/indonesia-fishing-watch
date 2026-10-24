import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { StateView } from "@/components/ui/StateView";
import { can, ROLE_LABELS } from "@/lib/auth/roles";
import { listPendingInvites, listUsers } from "@/lib/auth/service";
import { requireUser } from "@/lib/auth/session";
import { formatDateTimeUTC } from "@/lib/format";
import { UserAccessControls } from "@/components/settings/AdminControls";
import { InviteForm } from "../../(app)/settings/InviteForm";

export const metadata: Metadata = { title: "Pengguna & Akses" };

export default function CmsUsersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-page-title font-semibold text-ink">Pengguna & Hak Akses</h1>
        <p className="text-body text-ink-muted">
          Kelola anggota tim riset, undang peneliti baru, dan atur peran akses sistem.
        </p>
      </div>

      <Suspense fallback={<StateView state="loading" title="Memuat daftar pengguna…" />}>
        <UsersContent />
      </Suspense>
    </div>
  );
}

async function UsersContent() {
  const user = await requireUser();
  if (!can(user.role, "user:manage")) {
    return (
      <StateView state="unsupported" title="Khusus Admin">
        Halaman manajemen pengguna ini hanya dapat dibuka oleh peran Admin.
      </StateView>
    );
  }

  const users = listUsers();
  const invites = listPendingInvites();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader
          title="Undang Peneliti / Pengguna Baru"
          description="Tautan undangan berlaku 7 hari dan hanya ditampilkan sekali. Kirimkan tautan kepada anggota tim yang bersangkutan."
        />
        <div className="p-6 pt-0">
          <InviteForm />
        </div>
      </Card>

      <Card>
        <div className="p-6 border-b border-border">
          <h2 className="text-section-title font-semibold text-ink">Daftar Pengguna Aktif</h2>
          <p className="text-body text-ink-muted">
            Peran menentukan wewenang membaca data, mengunggah dataset riset, dan mengelola sistem.
          </p>
        </div>
        <DataTable
          caption="Daftar pengguna terdaftar"
          rows={users}
          rowKey={(row) => row.id}
          total={users.length}
          columns={[
            { key: "name", header: "Nama", cell: (row) => <span className="font-semibold text-ink">{row.name}</span> },
            { key: "email", header: "Email", cell: (row) => <span className="break-all font-mono text-caption">{row.email}</span> },
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
              header: "Ubah Akses",
              cell: (row) =>
                row.id === user.id ? (
                  <span className="text-caption text-ink-muted">Akun Anda</span>
                ) : (
                  <UserAccessControls userId={row.id} name={row.name} role={row.role} status={row.status} />
                ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
