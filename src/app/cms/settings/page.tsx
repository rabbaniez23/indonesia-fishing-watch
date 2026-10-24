import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { StateView } from "@/components/ui/StateView";
import { can } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { formatCount } from "@/lib/format";
import { BudgetForm } from "@/components/settings/AdminControls";
import { budgetToday } from "@/lib/gfw/http";
import { listRegions } from "@/lib/regions";
import { BUDGET_MAX, BUDGET_MIN } from "@/lib/settings";

export const metadata: Metadata = { title: "Pengaturan Sistem" };

export default function CmsSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-page-title font-semibold text-ink">Pengaturan Sistem & Data Upstream</h1>
        <p className="text-body text-ink-muted">
          Konfigurasi batas kuota API, status koneksi sumber data eksternal, dan katalog wilayah.
        </p>
      </div>

      <Suspense fallback={<StateView state="loading" title="Memuat pengaturan…" />}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}

async function SettingsContent() {
  const user = await requireUser();
  if (!can(user.role, "user:manage")) {
    return (
      <StateView state="unsupported" title="Khusus Admin">
        Halaman pengaturan ini hanya dapat dibuka oleh peran Admin.
      </StateView>
    );
  }

  const budget = budgetToday();
  const regions = listRegions();
  const tokenConfigured = Boolean(process.env.GFW_API_ACCESS_TOKEN);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader
          title="Budget Request Global Fishing Watch"
          description="Batas internal aplikasi untuk menjaga kuota upstream. Permintaan yang dilayani cache internal tidak memakan kuota ini."
        />
        <div className="p-6 pt-0 flex flex-col gap-4">
          <p className="text-ink-muted">
            Pemakaian Hari ini (UTC {budget.day}):{" "}
            <span className="tabular font-semibold text-ink">{formatCount(budget.upstreamRequests)}</span> dari batas{" "}
            <span className="tabular font-semibold text-ink">{formatCount(budget.limit)}</span> request
            {budget.cacheHits > 0 && (
              <span className="ml-2 text-caption text-[#166534]">
                ({formatCount(budget.cacheHits)} request dilayani cache)
              </span>
            )}
            .
          </p>
          <BudgetForm
            current={budget.limit}
            min={BUDGET_MIN}
            max={BUDGET_MAX}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Status Token & Wilayah Terdaftar"
          description="Status integrasi provider data utama dan cakupan wilayah kelautan Indonesia."
        />
        <div className="p-6 pt-0 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="text-body font-medium text-ink">Token Akses GFW:</span>
            {tokenConfigured ? (
              <Badge tone="success">Terkonfigurasi di Server (.env.local)</Badge>
            ) : (
              <Badge tone="warning">Belum Dikonfigurasi</Badge>
            )}
          </div>

          <div className="mt-2">
            <h4 className="text-caption font-semibold uppercase tracking-wider text-ink-muted mb-2">
              Katalog Wilayah ({regions.length} Wilayah)
            </h4>
            <div className="flex flex-wrap gap-2">
              {regions.map((r) => (
                <span
                  key={r.id}
                  className="rounded-button bg-surface border border-border px-3 py-1 text-caption font-medium text-ink"
                >
                  {r.name} ({r.code})
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
