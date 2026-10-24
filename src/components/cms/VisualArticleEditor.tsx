"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertCircle,
  Bold,
  CheckCircle2,
  Code,
  Eye,
  Heading1,
  Heading2,
  Heading3,
  HelpCircle,
  Image as ImageIcon,
  Info,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Sparkles,
  Strikethrough,
  Underline,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import {
  ARTICLE_CATEGORIES,
  ARTICLE_CATEGORY_LABELS,
  type ArticleCategory,
  type ArticleStatus,
  type CmsArticle,
} from "@/lib/cms/types";

type Props = {
  initialArticle?: CmsArticle | null;
  onSave: (article: Partial<CmsArticle>) => Promise<boolean>;
  onCancel: () => void;
};

export function VisualArticleEditor({ initialArticle, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(initialArticle?.title || "");
  const [slug, setSlug] = useState(initialArticle?.slug || "");
  const [category, setCategory] = useState<ArticleCategory>(initialArticle?.category || "panduan");
  const [excerpt, setExcerpt] = useState(initialArticle?.excerpt || "");
  const [coverImage, setCoverImage] = useState(initialArticle?.coverImage || "");
  const [status, setStatus] = useState<ArticleStatus>(initialArticle?.status || "draft");
  const [contentHtml, setContentHtml] = useState(initialArticle?.contentHtml || "");

  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);

  // Inisialisasi konten ke contentEditable
  useEffect(() => {
    if (editorRef.current && contentHtml && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = contentHtml;
    }
  }, [contentHtml]);

  function execCmd(command: string, value: string | undefined = undefined) {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    syncContent();
  }

  function syncContent() {
    if (editorRef.current) {
      setContentHtml(editorRef.current.innerHTML);
    }
  }

  function insertHeading(level: "h2" | "h3" | "p") {
    execCmd("formatBlock", `<${level}>`);
  }

  function insertCallout(type: "info" | "success" | "warning") {
    const titleText =
      type === "info" ? "Catatan Analisis:" : type === "success" ? "Temuan Lapangan:" : "Perhatian / Keterbatasan:";
    const borderColor =
      type === "info" ? "border-blue-500 bg-blue-50/70 text-blue-950" : type === "success" ? "border-[#166534] bg-emerald-50/70 text-emerald-950" : "border-amber-500 bg-amber-50/70 text-amber-950";

    const calloutHtml = `
      <div class="my-4 rounded-card border-l-4 p-4 ${borderColor}">
        <p class="font-bold text-caption uppercase tracking-wider mb-1">${titleText}</p>
        <p>Tuliskan ringkasan temuan atau catatan penting riset di sini…</p>
      </div><p><br></p>
    `;
    execCmd("insertHTML", calloutHtml);
  }

  function insertLink() {
    const url = prompt("Masukkan alamat URL tautan (misal: https://…):");
    if (url) {
      execCmd("createLink", url);
    }
  }

  function insertImage() {
    const url = prompt("Masukkan URL gambar ilustrasi atau peta:");
    if (url) {
      const caption = prompt("Keterangan gambar (caption opsional):") || "";
      const imgHtml = `
        <figure class="my-4">
          <img src="${url}" alt="${caption}" class="rounded-card border border-border w-full max-h-96 object-cover" />
          ${caption ? `<figcaption class="text-caption text-ink-muted text-center mt-1.5 italic">${caption}</figcaption>` : ""}
        </figure><p><br></p>
      `;
      execCmd("insertHTML", imgHtml);
    }
  }

  async function handleFormSubmit(targetStatus: ArticleStatus) {
    if (!title.trim()) {
      setErrorMessage("Judul artikel wajib diisi.");
      return;
    }

    const currentHtml = editorRef.current?.innerHTML || contentHtml;
    if (!currentHtml || currentHtml.trim() === "<p><br></p>" || currentHtml.trim().length < 5) {
      setErrorMessage("Isi konten artikel tidak boleh kosong.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const success = await onSave({
      title: title.trim(),
      slug: slug.trim() || undefined,
      category,
      excerpt: excerpt.trim() || undefined,
      coverImage: coverImage.trim() || undefined,
      contentHtml: currentHtml,
      status: targetStatus,
    });

    setIsSaving(false);
    if (!success) {
      setErrorMessage("Gagal menyimpan artikel. Pastikan judul dan slug tidak duplikat.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-section-title font-semibold text-ink">
            {initialArticle ? "Sunting Artikel Riset" : "Tulis Artikel & Panduan Riset Baru"}
          </h2>
          <p className="text-body text-ink-muted">
            Format tulisan visual ramah non-IT untuk menyusun metodologi, panduan, atau laporan investigasi maritim.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="secondary" size="compact" onClick={onCancel} disabled={isSaving}>
            Batal
          </Button>
          <Button
            variant="secondary"
            size="compact"
            onClick={() => handleFormSubmit("draft")}
            loading={isSaving && status === "draft"}
            disabled={isSaving}
          >
            Simpan Draf
          </Button>
          <Button
            variant="primary"
            size="compact"
            onClick={() => handleFormSubmit("published")}
            loading={isSaving && status === "published"}
            disabled={isSaving}
            icon={<CheckCircle2 className="size-4" />}
          >
            Publikasikan Sekarang
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-button border border-red-200 bg-red-50 p-4 text-caption text-error flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Grid Metadata Form */}
      <div className="grid grid-cols-1 gap-4 rounded-card border border-border bg-neutral-bg/20 p-5 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <TextField
            label="Judul Artikel / Panduan"
            placeholder="Contoh: Analisis Dinamika Armada Kapal Lampu di WPP 711 Musim Barat"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            helper="Judul utama yang akan muncul di daftar panduan dan artikel riset"
          />
        </div>

        <SelectField
          label="Kategori Tulisan"
          value={category}
          onChange={(e) => setCategory(e.target.value as ArticleCategory)}
          helper="Kelompok artikel di portal publik"
        >
          {ARTICLE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {ARTICLE_CATEGORY_LABELS[c]}
            </option>
          ))}
        </SelectField>

        <div className="sm:col-span-2">
          <TextField
            label="Ringkasan Singkat / Abstrak (Excerpt)"
            placeholder="1–2 kalimat rangkuman singkat untuk kartu pratinjau…"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
          />
        </div>

        <TextField
          label="URL Gambar Sampul (Opsional)"
          placeholder="https://…/gambar.jpg"
          value={coverImage}
          onChange={(e) => setCoverImage(e.target.value)}
        />
      </div>

      {/* Editor & Preview Toggle Tabs */}
      <div className="flex flex-col rounded-card border border-border bg-surface shadow-xs">
        <div className="flex items-center justify-between border-b border-border bg-neutral-bg/40 px-4 py-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("edit")}
              className={`rounded-button px-3 py-1.5 text-caption font-medium transition-colors ${
                activeTab === "edit" ? "bg-surface shadow-xs text-ink font-semibold" : "text-ink-muted hover:text-ink"
              }`}
            >
              Editor Visual (Tulis)
            </button>
            <button
              type="button"
              onClick={() => {
                syncContent();
                setActiveTab("preview");
              }}
              className={`flex items-center gap-1.5 rounded-button px-3 py-1.5 text-caption font-medium transition-colors ${
                activeTab === "preview"
                  ? "bg-surface shadow-xs text-ink font-semibold"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <Eye className="size-3.5" />
              <span>Pratinjau Pembaca</span>
            </button>
          </div>

          <span className="text-caption text-ink-muted hidden sm:inline">
            Dapat menggunakan shortcut keyboard: <strong>Ctrl+B</strong> (Tebal), <strong>Ctrl+I</strong> (Miring)
          </span>
        </div>

        {activeTab === "edit" ? (
          <div>
            {/* Visual Formatting Toolbar */}
            <div className="flex flex-wrap items-center gap-1 border-b border-border bg-surface p-2 text-ink">
              {/* Headings */}
              <button
                type="button"
                onClick={() => insertHeading("h2")}
                title="Judul Bagian (H2)"
                className="rounded-button p-1.5 hover:bg-neutral-bg"
              >
                <Heading2 className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => insertHeading("h3")}
                title="Subjudul (H3)"
                className="rounded-button p-1.5 hover:bg-neutral-bg"
              >
                <Heading3 className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => insertHeading("p")}
                title="Paragraf Biasa"
                className="rounded-button px-2 py-1 text-caption font-semibold hover:bg-neutral-bg"
              >
                P
              </button>

              <div className="mx-1 h-5 w-px bg-border" />

              {/* Basic Styles */}
              <button
                type="button"
                onClick={() => execCmd("bold")}
                title="Tebal (Ctrl+B)"
                className="rounded-button p-1.5 hover:bg-neutral-bg"
              >
                <Bold className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => execCmd("italic")}
                title="Miring (Ctrl+I)"
                className="rounded-button p-1.5 hover:bg-neutral-bg"
              >
                <Italic className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => execCmd("underline")}
                title="Garis Bawah (Ctrl+U)"
                className="rounded-button p-1.5 hover:bg-neutral-bg"
              >
                <Underline className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => execCmd("strikeThrough")}
                title="Coret"
                className="rounded-button p-1.5 hover:bg-neutral-bg"
              >
                <Strikethrough className="size-4" />
              </button>

              <div className="mx-1 h-5 w-px bg-border" />

              {/* Lists */}
              <button
                type="button"
                onClick={() => execCmd("insertUnorderedList")}
                title="Daftar Poin (Bullet List)"
                className="rounded-button p-1.5 hover:bg-neutral-bg"
              >
                <List className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => execCmd("insertOrderedList")}
                title="Daftar Nomor (Numbered List)"
                className="rounded-button p-1.5 hover:bg-neutral-bg"
              >
                <ListOrdered className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => execCmd("formatBlock", "<blockquote>")}
                title="Kutipan / Blockquote"
                className="rounded-button p-1.5 hover:bg-neutral-bg"
              >
                <Quote className="size-4" />
              </button>

              <div className="mx-1 h-5 w-px bg-border" />

              {/* Callouts */}
              <button
                type="button"
                onClick={() => insertCallout("info")}
                title="Sisipkan Kotak Info"
                className="rounded-button p-1.5 text-blue-700 hover:bg-blue-50"
              >
                <Info className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => insertCallout("success")}
                title="Sisipkan Kotak Temuan"
                className="rounded-button p-1.5 text-[#166534] hover:bg-emerald-50"
              >
                <CheckCircle2 className="size-4" />
              </button>

              <div className="mx-1 h-5 w-px bg-border" />

              {/* Media / Links */}
              <button
                type="button"
                onClick={insertLink}
                title="Sisipkan Tautan Web"
                className="rounded-button p-1.5 hover:bg-neutral-bg"
              >
                <LinkIcon className="size-4" />
              </button>
              <button
                type="button"
                onClick={insertImage}
                title="Sisipkan Gambar Ilustrasi"
                className="rounded-button p-1.5 hover:bg-neutral-bg"
              >
                <ImageIcon className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => execCmd("insertHorizontalRule")}
                title="Garis Pembatas"
                className="rounded-button p-1.5 hover:bg-neutral-bg"
              >
                <Minus className="size-4" />
              </button>
            </div>

            {/* ContentEditable Canvas */}
            <div
              ref={editorRef}
              contentEditable
              onInput={syncContent}
              onBlur={syncContent}
              className="min-h-[420px] p-6 text-body text-ink focus:outline-none prose prose-slate max-w-none [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1 [&_p]:my-2 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-3 [&_a]:text-primary [&_a]:underline"
              data-placeholder="Tuliskan isi panduan, analisis data, atau laporan riset maritim Anda di sini…"
            />
          </div>
        ) : (
          /* Live Reader Preview */
          <div className="p-8 max-w-3xl mx-auto w-full">
            <div className="flex flex-col gap-3 border-b border-border pb-6 mb-6">
              <Badge tone="neutral">{ARTICLE_CATEGORY_LABELS[category]}</Badge>
              <h1 className="text-3xl font-bold text-ink leading-tight">{title || "Judul Artikel"}</h1>
              {excerpt && <p className="text-lg text-ink-muted leading-relaxed italic">{excerpt}</p>}
            </div>

            {coverImage && (
              <img
                src={coverImage}
                alt={title}
                className="w-full max-h-96 object-cover rounded-card border border-border mb-6"
              />
            )}

            <div
              className="text-body text-ink leading-relaxed prose prose-slate max-w-none [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-3 [&_a]:text-primary [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: contentHtml || "<p class='text-ink-muted italic'>Belum ada isi konten.</p>" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
