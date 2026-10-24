import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, FileText, User } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { formatDateTimeUTC } from "@/lib/format";
import { getArticleBySlug } from "@/lib/cms/articles";
import { ARTICLE_CATEGORY_LABELS } from "@/lib/cms/types";

export async function generateMetadata({
  params,
}: PageProps<"/dokumentasi/artikel/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return { title: "Artikel Tidak Ditemukan" };
  return {
    title: article.title,
    description: article.excerpt || "Artikel riset dan panduan Indonesia Fishing Watch.",
  };
}

export default async function DynamicArticlePage({
  params,
}: PageProps<"/dokumentasi/artikel/[slug]">) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article || article.status !== "published") {
    notFound();
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
        {/* Back Link */}
        <div>
          <Link
            href="/dokumentasi"
            className="inline-flex items-center gap-2 text-caption font-semibold text-primary hover:underline"
          >
            <ArrowLeft className="size-4" />
            <span>Kembali ke Panduan & Dokumentasi</span>
          </Link>
        </div>

        {/* Article Header Card */}
        <div className="flex flex-col gap-3 border-b border-border pb-6">
          <div className="flex items-center gap-2">
            <Badge tone="info">{ARTICLE_CATEGORY_LABELS[article.category]}</Badge>
            <span className="text-caption text-ink-muted">· Catatan Riset Terverifikasi</span>
          </div>

          <h1 className="text-3xl font-bold text-ink leading-tight sm:text-4xl">{article.title}</h1>

          {article.excerpt && (
            <p className="text-lg text-ink-muted leading-relaxed italic">{article.excerpt}</p>
          )}

          <div className="flex flex-wrap items-center gap-4 pt-2 text-caption text-ink-muted">
            <span className="flex items-center gap-1.5">
              <User className="size-3.5" />
              <span>Oleh: <strong className="text-ink">{article.author.name}</strong></span>
            </span>
            <span>·</span>
            <span className="flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              <span>Dipublikasikan: {article.publishedAt ? formatDateTimeUTC(article.publishedAt) : "-"}</span>
            </span>
          </div>
        </div>

        {/* Cover Image */}
        {article.coverImage && (
          <div className="overflow-hidden rounded-card border border-border bg-surface shadow-xs">
            <img
              src={article.coverImage}
              alt={article.title}
              className="w-full max-h-[420px] object-cover"
            />
          </div>
        )}

        {/* Article Body Content */}
        <Card>
          <div className="p-6 sm:p-10">
            <div
              className="text-body text-ink leading-relaxed prose prose-slate max-w-none [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:my-4 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-4 [&_a]:text-primary [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: article.contentHtml }}
            />
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
