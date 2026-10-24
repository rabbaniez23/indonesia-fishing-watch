import type { Metadata } from "next";
import { Suspense } from "react";
import { ArticlesManagementClient } from "@/components/cms/ArticlesManagementClient";
import { StateView } from "@/components/ui/StateView";
import { requireUser } from "@/lib/auth/session";
import { listArticles } from "@/lib/cms/articles";

export const metadata: Metadata = {
  title: "Konten & Panduan Riset",
  description: "Kelola dan publikasikan artikel analisis, panduan, dan materi edukasi maritim.",
};

export default function CmsArticlesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-page-title font-semibold text-ink">Konten, Panduan, & Buletin Riset</h1>
        <p className="text-body text-ink-muted">
          Pusat publikasi tulisan visual untuk tim peneliti. Tuliskan metodologi, catatan analisis WPP, dan panduan sistem.
        </p>
      </div>

      <Suspense fallback={<StateView state="loading" title="Memuat daftar tulisan…" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const user = await requireUser();
  const initialArticles = listArticles();

  return <ArticlesManagementClient initialArticles={initialArticles} userRole={user.role} />;
}
