import type { Metadata } from "next";
import { Suspense } from "react";
import { DataManagementClient } from "@/components/cms/DataManagementClient";
import { StateView } from "@/components/ui/StateView";
import { requireUser } from "@/lib/auth/session";
import { listResearchDatasets } from "@/lib/cms/datasets";

export const metadata: Metadata = {
  title: "Data & Dataset Riset",
  description: "Portal pengunggahan dan manajemen dataset riset mandiri oleh peneliti.",
};

export default function CmsDataPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-page-title font-semibold text-ink">Manajemen Data & Dataset Riset</h1>
        <p className="text-body text-ink-muted">
          Unggah dan kelola file data pengamatan kapal lapangan (CSV), pembaruan satelit VIIRS, dan lapisan spasial (GeoJSON).
        </p>
      </div>

      <Suspense fallback={<StateView state="loading" title="Memuat katalog data…" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const user = await requireUser();
  const initialDatasets = listResearchDatasets();

  return <DataManagementClient initialDatasets={initialDatasets} userRole={user.role} />;
}
