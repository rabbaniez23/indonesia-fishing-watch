import type { Metadata } from "next";
import { getActivityStats, listActivities } from "@/lib/cms/activity";
import { ActivityManagementClient } from "@/components/cms/ActivityManagementClient";

export const metadata: Metadata = {
  title: "Statistik & Log Aktivitas CMS",
};

export default function CmsActivityPage() {
  const initialData = listActivities({ page: 1, pageSize: 20 });
  const initialStats = getActivityStats();

  return <ActivityManagementClient initialData={initialData} initialStats={initialStats} />;
}
