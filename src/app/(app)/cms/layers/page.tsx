import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { AdminOnly } from "@/components/cms/AdminOnly";
import { LayersManagementClient } from "@/components/cms/LayersManagementClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateView } from "@/components/ui/StateView";
import { can } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { listResearchDatasets } from "@/lib/cms/datasets";
import { listCustomLayers } from "@/lib/cms/layers";

export const metadata: Metadata = { title: "Lapisan peta kustom" };

export default function CmsLayersPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Lapisan peta kustom"
        description="Buat lapisan dari dataset spasial (zona konservasi, batas riset, titik pengamatan) agar bisa dicentang di menu Peta."
      />
      <Suspense fallback={<StateView state="loading" title="Memuat konfigurasi lapisan…" />}>
        <Content />
      </Suspense>
    </PageContainer>
  );
}

async function Content() {
  const user = await requireUser();
  if (!can(user.role, "cms:manage")) return <AdminOnly />;
  return <LayersManagementClient initialLayers={listCustomLayers()} availableDatasets={listResearchDatasets()} />;
}
