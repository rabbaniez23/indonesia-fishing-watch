"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  Edit,
  Eye,
  FileText,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import { StateView } from "@/components/ui/StateView";
import { formatDateTimeUTC } from "@/lib/format";
import {
  ARTICLE_CATEGORIES,
  ARTICLE_CATEGORY_LABELS,
  type ArticleCategory,
  type CmsArticle,
} from "@/lib/cms/types";
import { VisualArticleEditor } from "./VisualArticleEditor";

type Props = {
  initialArticles: CmsArticle[];
  userRole: string;
};

export function ArticlesManagementClient({ initialArticles, userRole }: Props) {
  const [articles, setArticles] = useState<CmsArticle[]>(initialArticles);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  // Mode editor: null = daftar tabel, CmsArticle = edit existing, "new" = create new
  const [editingArticle, setEditingArticle] = useState<CmsArticle | "new" | null>(null);

  // Filter artikel
  const filteredArticles = articles.filter((a) => {
    const matchCat = filterCategory === "all" || a.category === filterCategory;
    const matchStatus = filterStatus === "all" || a.status === filterStatus;
    const matchSearch =
      searchQuery === "" ||
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.excerpt && a.excerpt.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchStatus && matchSearch;
  });

  // Handler Simpan dari Editor (Create / Update)
  async function handleSaveArticle(data: Partial<CmsArticle>): Promise<boolean> {
    try {
      if (editingArticle && typeof editingArticle === "object" && editingArticle.id) {
        // UPDATE
        const res = await fetch(`/api/cms/articles/${editingArticle.id}`, {
          credentials: "same-origin",
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (json.ok) {
          setArticles((prev) => prev.map((a) => (a.id === editingArticle.id ? json.data : a)));
          setEditingArticle(null);
          return true;
        }
      } else {
        // CREATE
        const res = await fetch("/api/cms/articles", {
          credentials: "same-origin",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (json.ok) {
          setArticles((prev) => [json.data, ...prev]);
          setEditingArticle(null);
          return true;
        }
      }
    } catch {
      // error
    }
    return false;
  }

  // Handler Hapus
  async function handleDelete(article: CmsArticle) {
    if (!confirm(`Hapus artikel "${article.title}"? Tindakan ini tidak dapat dibatalkan.`)) return;

    try {
      const res = await fetch(`/api/cms/articles/${article.id}`, {
        credentials: "same-origin",
        method: "DELETE",
      });
      const json = await res.json();
      if (json.ok) {
        setArticles((prev) => prev.filter((a) => a.id !== article.id));
      } else {
        alert(json.error?.message || "Gagal menghapus artikel.");
      }
    } catch {
      alert("Kesalahan jaringan saat menghapus artikel.");
    }
  }

  function refresh() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/cms/articles", { credentials: "same-origin" });
        const json = await res.json();
        if (json.ok) setArticles(json.data);
      } catch {
        // ignore
      }
    });
  }

  // Jika sedang membuka editor visual, tampilkan komponen editor
  if (editingArticle) {
    return (
      <VisualArticleEditor
        initialArticle={typeof editingArticle === "object" ? editingArticle : null}
        onSave={handleSaveArticle}
        onCancel={() => setEditingArticle(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-4 border-b border-border p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-section-title font-semibold text-ink">Konten, Panduan, & Buletin Riset</h2>
            <p className="text-body text-ink-muted">
              Tulis dan publikasikan panduan metodologi, analisis berkala, dan edukasi maritim langsung dari CMS.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="compact"
              icon={<RefreshCw className={`size-4 ${isPending ? "animate-spin" : ""}`} />}
              onClick={refresh}
              disabled={isPending}
            >
              Segarkan
            </Button>
            <Button
              variant="primary"
              size="compact"
              icon={<Plus className="size-4" />}
              onClick={() => setEditingArticle("new")}
            >
              + Tulis Artikel Baru
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col gap-3 border-b border-border bg-neutral-bg/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-caption font-medium text-ink-muted">Kategori:</span>
            <button
              type="button"
              onClick={() => setFilterCategory("all")}
              className={`rounded-button px-3 py-1.5 text-caption font-medium transition-colors ${
                filterCategory === "all"
                  ? "bg-primary text-inverse"
                  : "bg-surface border border-border text-ink hover:bg-neutral-bg"
              }`}
            >
              Semua ({articles.length})
            </button>
            {ARTICLE_CATEGORIES.map((c) => {
              const count = articles.filter((a) => a.category === c).length;
              if (count === 0 && filterCategory !== c) return null;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFilterCategory(c)}
                  className={`rounded-button px-3 py-1.5 text-caption font-medium transition-colors ${
                    filterCategory === c
                      ? "bg-primary text-inverse"
                      : "bg-surface border border-border text-ink hover:bg-neutral-bg"
                  }`}
                >
                  {ARTICLE_CATEGORY_LABELS[c]} ({count})
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="search"
              placeholder="Cari judul tulisan…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-input border border-border-control bg-surface pl-9 pr-3 text-body placeholder:text-ink-muted"
            />
          </div>
        </div>

        {/* Table List */}
        {filteredArticles.length === 0 ? (
          <div className="py-12">
            <StateView
              state="empty"
              title="Belum ada artikel riset"
              action={
                <Button
                  variant="primary"
                  size="compact"
                  icon={<Plus className="size-4" />}
                  onClick={() => setEditingArticle("new")}
                >
                  Tulis Artikel Pertama
                </Button>
              }
            >
              Peneliti dapat menyusun panduan metodologi, ringkasan temuan, atau materi oseanografi dengan editor visual.
            </StateView>
          </div>
        ) : (
          <DataTable
            caption="Daftar artikel riset dan panduan"
            rows={filteredArticles}
            rowKey={(r) => r.id}
            total={filteredArticles.length}
            columns={[
              {
                key: "title",
                header: "Judul Artikel & Ringkasan",
                cell: (row) => (
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-ink">{row.title}</span>
                    <span className="text-caption font-mono text-ink-muted">/dokumentasi/artikel/{row.slug}</span>
                    {row.excerpt && <span className="text-caption text-ink-muted line-clamp-1 italic">{row.excerpt}</span>}
                  </div>
                ),
              },
              {
                key: "category",
                header: "Kategori",
                cell: (row) => <Badge tone="neutral">{ARTICLE_CATEGORY_LABELS[row.category] || row.category}</Badge>,
              },
              {
                key: "status",
                header: "Status",
                cell: (row) =>
                  row.status === "published" ? (
                    <Badge tone="success">Terpublikasi</Badge>
                  ) : (
                    <Badge tone="neutral">Draf</Badge>
                  ),
              },
              {
                key: "author",
                header: "Penulis & Tanggal",
                cell: (row) => (
                  <div className="flex flex-col text-caption text-ink-muted">
                    <span className="font-medium text-ink">{row.author.name}</span>
                    <span>{row.publishedAt ? formatDateTimeUTC(row.publishedAt) : formatDateTimeUTC(row.createdAt)}</span>
                  </div>
                ),
              },
              {
                key: "actions",
                header: "Aksi",
                cell: (row) => (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      title="Sunting Artikel"
                      onClick={() => setEditingArticle(row)}
                      className="rounded-button p-1.5 text-primary hover:bg-primary-soft transition-colors"
                    >
                      <Edit className="size-4" />
                    </button>
                    {row.status === "published" && (
                      <Link
                        href={`/dokumentasi/artikel/${row.slug}`}
                        title="Buka Halaman Pembaca"
                        className="rounded-button p-1.5 text-ink hover:bg-neutral-bg transition-colors"
                      >
                        <Eye className="size-4" />
                      </Link>
                    )}
                    <button
                      type="button"
                      title="Hapus Artikel"
                      onClick={() => handleDelete(row)}
                      className="rounded-button p-1.5 text-error hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
