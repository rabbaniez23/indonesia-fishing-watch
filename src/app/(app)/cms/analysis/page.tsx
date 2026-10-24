import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { AdminOnly } from "@/components/cms/AdminOnly";
import { AnalysisInsightsManagementClient } from "@/components/cms/AnalysisInsightsManagementClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateView } from "@/components/ui/StateView";
import { can } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { listAnalysisInsights } from "@/lib/cms/analysis-insights";
import { listRegions } from "@/lib/regions";

export const metadata: Metadata = { title: "Catatan analisis" };

export default function CmsAnalysisPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Catatan analisis"
        description="Interpretasi, temuan, dan peringatan yang tampil di menu Statistik aktivitas sesuai tab dan wilayah yang dipilih pengguna."
      />
      <Suspense fallback={<StateView state="loading" title="Memuat catatan…" />}>
        <Content />
      </Suspense>
    </PageContainer>
  );
}

async function Content() {
  const user = await requireUser();
  if (!can(user.role, "cms:manage")) return <AdminOnly />;
  const regions = listRegions()
    .filter((r) => r.analyzable)
    .map((r) => ({ id: r.id, name: r.name, type: r.type }));
  return <AnalysisInsightsManagementClient initialInsights={listAnalysisInsights()} regions={regions} />;
}
