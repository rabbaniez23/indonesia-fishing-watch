import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { AdminOnly } from "@/components/cms/AdminOnly";
import { ActivityManagementClient } from "@/components/cms/ActivityManagementClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateView } from "@/components/ui/StateView";
import { can } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { getActivityStats, listActivities } from "@/lib/cms/activity";

export const metadata: Metadata = { title: "Log aktivitas" };

export default function CmsActivityPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Log aktivitas"
        description="Riwayat tindakan tim (dataset, lapisan peta, artikel, catatan, akun) beserta tren 14 hari terakhir; bisa diekspor ke CSV."
      />
      <Suspense fallback={<StateView state="loading" title="Memuat log…" />}>
        <Content />
      </Suspense>
    </PageContainer>
  );
}

async function Content() {
  const user = await requireUser();
  if (!can(user.role, "cms:manage")) return <AdminOnly />;
  return <ActivityManagementClient initialData={listActivities({ page: 1, pageSize: 20 })} initialStats={getActivityStats()} />;
}
