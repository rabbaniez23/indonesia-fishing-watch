import { beforeEach, describe, expect, it } from "vitest";
import { openDatabase, setDbForTesting } from "@/lib/db";
import {
  createArticle,
  deleteArticle,
  getArticleById,
  getArticleBySlug,
  listArticles,
  slugify,
  updateArticle,
} from "./articles";

describe("cms articles service", () => {
  beforeEach(() => {
    const db = openDatabase(":memory:");
    setDbForTesting(db);
    db.prepare(`
      INSERT INTO users (id, email, name, role, password_hash, status, created_at, updated_at)
      VALUES ('u1', 'peneliti@kkp.go.id', 'Peneliti Maritim', 'admin', 'hash', 'active', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z')
    `).run();
  });

  it("slugifies titles correctly", () => {
    expect(slugify("Analisis Armada WPP-711 & Musim Barat!")).toBe("analisis-armada-wpp-711-musim-barat");
    expect(slugify("  Panduan   Sistem   ")).toBe("panduan-sistem");
  });

  it("membersihkan HTML & URL sampul berbahaya saat disimpan dan diubah", () => {
    const a = createArticle({
      title: "Uji XSS",
      category: "panduan",
      contentHtml: '<p>Aman</p><img src="x" onerror="alert(1)"><script>alert(1)</script>',
      coverImage: "javascript:alert(1)",
      status: "draft",
      userId: "u1",
    });
    expect(a.contentHtml).toBe('<p>Aman</p><img src="x" />');
    expect(a.coverImage).toBeNull();
    const b = updateArticle(a.id, { contentHtml: '<a href="javascript:alert(1)" onclick="x()">t</a>' }, "u1");
    expect(b?.contentHtml).not.toMatch(/javascript:|onclick/);
  });

  it("creates an article and generates unique slugs", () => {
    const a1 = createArticle({
      title: "Panduan Pemantauan Satelit",
      category: "panduan",
      contentHtml: "<p>Konten panduan 1</p>",
      status: "published",
      userId: "u1",
    });

    expect(a1.id).toBeDefined();
    expect(a1.slug).toBe("panduan-pemantauan-satelit");
    expect(a1.status).toBe("published");
    expect(a1.publishedAt).toBeDefined();

    // Buat artikel kedua dengan judul yang sama -> slug unik otomatis
    const a2 = createArticle({
      title: "Panduan Pemantauan Satelit",
      category: "panduan",
      contentHtml: "<p>Konten panduan 2</p>",
      status: "draft",
      userId: "u1",
    });

    expect(a2.slug).toBe("panduan-pemantauan-satelit-1");
    expect(a2.status).toBe("draft");
    expect(a2.publishedAt).toBeNull();

    const list = listArticles();
    expect(list.length).toBe(2);

    const published = listArticles({ status: "published" });
    expect(published.length).toBe(1);
    expect(published[0].id).toBe(a1.id);
  });

  it("fetches article by slug", () => {
    createArticle({
      title: "Edukasi Oseanografi Klorofil",
      slug: "edukasi-klorofil",
      category: "oseanografi",
      excerpt: "Mengenal klorofil-a dan daerah penangkapan ikan.",
      contentHtml: "<p>Klorofil-a tinggi menandakan fitoplankton melimpah.</p>",
      status: "published",
      userId: "u1",
    });

    const found = getArticleBySlug("edukasi-klorofil");
    expect(found).not.toBeNull();
    expect(found?.title).toBe("Edukasi Oseanografi Klorofil");
    expect(found?.author.name).toBe("Peneliti Maritim");
  });

  it("updates and deletes an article", () => {
    const created = createArticle({
      title: "Draf Awal",
      category: "analisis",
      contentHtml: "<p>Draf</p>",
      status: "draft",
      userId: "u1",
    });

    const updated = updateArticle(
      created.id,
      {
        title: "Analisis Final WPP 711",
        status: "published",
        contentHtml: "<p>Konten final</p>",
      },
      "u1",
    );

    expect(updated?.title).toBe("Analisis Final WPP 711");
    expect(updated?.status).toBe("published");
    expect(updated?.publishedAt).not.toBeNull();

    const deleted = deleteArticle(created.id, "u1");
    expect(deleted).toBe(true);

    expect(getArticleById(created.id)).toBeNull();
  });
});
