import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { AdminOnly } from "@/components/cms/AdminOnly";
import { ArticlesManagementClient } from "@/components/cms/ArticlesManagementClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateView } from "@/components/ui/StateView";
import { can } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { listArticles } from "@/lib/cms/articles";

export const metadata: Metadata = { title: "Artikel" };

export default function CmsArticlesPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Artikel"
        description="Tulis panduan, metodologi, dan catatan riset. Artikel yang diterbitkan muncul di Dokumentasi · Panduan untuk semua pengguna."
      />
      <Suspense fallback={<StateView state="loading" title="Memuat daftar tulisan…" />}>
        <Content />
      </Suspense>
    </PageContainer>
  );
}

async function Content() {
  const user = await requireUser();
  if (!can(user.role, "cms:manage")) return <AdminOnly />;
  return <ArticlesManagementClient initialArticles={listArticles()} />;
}
