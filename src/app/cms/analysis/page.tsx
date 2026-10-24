import type { Metadata } from "next";
import { listAnalysisInsights } from "@/lib/cms/analysis-insights";
import { listRegions } from "@/lib/regions";
import { AnalysisInsightsManagementClient } from "@/components/cms/AnalysisInsightsManagementClient";

export const metadata: Metadata = {
  title: "Manajemen Insight Analisis (/analysis)",
};

export default function CmsAnalysisPage() {
  const initialInsights = listAnalysisInsights();
  const regions = listRegions()
    .filter((r) => r.analyzable)
    .map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
    }));

  return (
    <AnalysisInsightsManagementClient
      initialInsights={initialInsights}
      regions={regions}
    />
  );
}
