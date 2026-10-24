import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { AdminOnly } from "@/components/cms/AdminOnly";
import { DataManagementClient } from "@/components/cms/DataManagementClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateView } from "@/components/ui/StateView";
import { can } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { listResearchDatasets } from "@/lib/cms/datasets";

export const metadata: Metadata = { title: "Dataset riset" };

export default function CmsDataPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Dataset riset"
        description="Unggah dan kelola data pengamatan lapangan (CSV) dan lapisan spasial (GeoJSON). Dataset berkoordinat bisa dijadikan lapisan peta."
      />
      <Suspense fallback={<StateView state="loading" title="Memuat katalog data…" />}>
        <Content />
      </Suspense>
    </PageContainer>
  );
}

async function Content() {
  const user = await requireUser();
  if (!can(user.role, "cms:manage")) return <AdminOnly />;
  return <DataManagementClient initialDatasets={listResearchDatasets()} />;
}
