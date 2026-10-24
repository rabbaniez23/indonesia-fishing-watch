import type { Metadata } from "next";
import { Suspense } from "react";
import { LayersManagementClient } from "@/components/cms/LayersManagementClient";
import { StateView } from "@/components/ui/StateView";
import { requireUser } from "@/lib/auth/session";
import { listResearchDatasets } from "@/lib/cms/datasets";
import { listCustomLayers } from "@/lib/cms/layers";

export const metadata: Metadata = {
  title: "Lapisan Peta Kustom",
  description: "Konfigurasikan lapisan peta baru untuk ditampilkan pada peta pemantauan utama.",
};

export default function CmsLayersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-page-title font-semibold text-ink">Lapisan Peta Kustom (Custom Layers)</h1>
        <p className="text-body text-ink-muted">
          Buat dan konfigurasikan lapisan baru (zona konservasi, batas wilayah riset, atau titik kapal) agar muncul di Peta Pemantauan Utama.
        </p>
      </div>

      <Suspense fallback={<StateView state="loading" title="Memuat konfigurasi lapisan…" />}>
        <LayersContent />
      </Suspense>
    </div>
  );
}

async function LayersContent() {
  const user = await requireUser();
  const layers = listCustomLayers();
  const datasets = listResearchDatasets();

  return (
    <LayersManagementClient
      initialLayers={layers}
      availableDatasets={datasets}
      userRole={user.role}
    />
  );
}
