import { getDb, newId, nowIso, transaction } from "@/lib/db";
import type { ArticleCategory, ArticleStatus, CmsArticle } from "./types";

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type ArticleRow = {
  id: string;
  title: string;
  slug: string;
  category: ArticleCategory;
  excerpt: string | null;
  content_html: string;
  cover_image: string | null;
  status: ArticleStatus;
  author_id: string;
  author_name: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

function rowToArticle(row: ArticleRow): CmsArticle {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: row.category,
    excerpt: row.excerpt,
    contentHtml: row.content_html,
    coverImage: row.cover_image,
    status: row.status,
    author: {
      id: row.author_id,
      name: row.author_name || "Peneliti",
    },
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type CreateArticleInput = {
  title: string;
  slug?: string;
  category: ArticleCategory;
  excerpt?: string;
  contentHtml: string;
  coverImage?: string;
  status?: ArticleStatus;
  userId: string;
};

export function createArticle(input: CreateArticleInput): CmsArticle {
  const db = getDb();
  const id = newId();
  const now = nowIso();

  let baseSlug = input.slug ? slugify(input.slug) : slugify(input.title);
  if (!baseSlug) baseSlug = `artikel-${id.slice(0, 8)}`;

  // Pastikan slug unik
  let uniqueSlug = baseSlug;
  let counter = 1;
  while (db.prepare("SELECT 1 FROM cms_articles WHERE slug = ?").get(uniqueSlug)) {
    uniqueSlug = `${baseSlug}-${counter++}`;
  }

  const status = input.status || "draft";
  const publishedAt = status === "published" ? now : null;

  transaction(db, () => {
    db.prepare(`
      INSERT INTO cms_articles (
        id, title, slug, category, excerpt, content_html, cover_image,
        status, author_id, published_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.title,
      uniqueSlug,
      input.category,
      input.excerpt || null,
      input.contentHtml,
      input.coverImage || null,
      status,
      input.userId,
      publishedAt,
      now,
      now,
    );

    db.prepare(`
      INSERT INTO audit_entries (id, actor_id, action, entity_type, entity_id, changes_json, occurred_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      newId(),
      input.userId,
      "article:create",
      "cms_article",
      id,
      JSON.stringify({ title: input.title, slug: uniqueSlug, category: input.category, status }),
      now,
    );
  });

  return getArticleById(id)!;
}

export function listArticles(options?: {
  status?: ArticleStatus;
  category?: ArticleCategory;
}): CmsArticle[] {
  const db = getDb();
  let query = `
    SELECT a.*, u.name as author_name
    FROM cms_articles a
    LEFT JOIN users u ON u.id = a.author_id
  `;
  const conditions: string[] = [];
  const params: string[] = [];

  if (options?.status) {
    conditions.push("a.status = ?");
    params.push(options.status);
  }
  if (options?.category) {
    conditions.push("a.category = ?");
    params.push(options.category);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  query += " ORDER BY a.created_at DESC";

  const rows = db.prepare(query).all(...params) as ArticleRow[];
  return rows.map(rowToArticle);
}

export function getArticleById(id: string): CmsArticle | null {
  const db = getDb();
  const row = db
    .prepare(`
      SELECT a.*, u.name as author_name
      FROM cms_articles a
      LEFT JOIN users u ON u.id = a.author_id
      WHERE a.id = ?
    `)
    .get(id) as ArticleRow | undefined;

  return row ? rowToArticle(row) : null;
}

export function getArticleBySlug(slug: string): CmsArticle | null {
  const db = getDb();
  const row = db
    .prepare(`
      SELECT a.*, u.name as author_name
      FROM cms_articles a
      LEFT JOIN users u ON u.id = a.author_id
      WHERE a.slug = ?
    `)
    .get(slug) as ArticleRow | undefined;

  return row ? rowToArticle(row) : null;
}

export function updateArticle(
  id: string,
  input: {
    title?: string;
    slug?: string;
    category?: ArticleCategory;
    excerpt?: string;
    contentHtml?: string;
    coverImage?: string;
    status?: ArticleStatus;
  },
  userId: string,
): CmsArticle | null {
  const db = getDb();
  const existing = getArticleById(id);
  if (!existing) return null;

  const now = nowIso();
  const title = input.title !== undefined ? input.title : existing.title;
  let slug = existing.slug;
  if (input.slug !== undefined && input.slug !== existing.slug) {
    let candidate = slugify(input.slug);
    let counter = 1;
    while (
      db.prepare("SELECT 1 FROM cms_articles WHERE slug = ? AND id != ?").get(candidate, id)
    ) {
      candidate = `${slugify(input.slug)}-${counter++}`;
    }
    slug = candidate;
  }

  const category = input.category !== undefined ? input.category : existing.category;
  const excerpt = input.excerpt !== undefined ? input.excerpt : existing.excerpt;
  const contentHtml = input.contentHtml !== undefined ? input.contentHtml : existing.contentHtml;
  const coverImage = input.coverImage !== undefined ? input.coverImage : existing.coverImage;
  const status = input.status !== undefined ? input.status : existing.status;

  let publishedAt = existing.publishedAt;
  if (status === "published" && !existing.publishedAt) {
    publishedAt = now;
  }

  transaction(db, () => {
    db.prepare(`
      UPDATE cms_articles
      SET title = ?, slug = ?, category = ?, excerpt = ?, content_html = ?,
          cover_image = ?, status = ?, published_at = ?, updated_at = ?
      WHERE id = ?
    `).run(
      title,
      slug,
      category,
      excerpt,
      contentHtml,
      coverImage,
      status,
      publishedAt,
      now,
      id,
    );

    db.prepare(`
      INSERT INTO audit_entries (id, actor_id, action, entity_type, entity_id, changes_json, occurred_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      newId(),
      userId,
      "article:update",
      "cms_article",
      id,
      JSON.stringify(input),
      now,
    );
  });

  return getArticleById(id);
}

export function deleteArticle(id: string, userId: string): boolean {
  const db = getDb();
  const existing = getArticleById(id);
  if (!existing) return false;

  transaction(db, () => {
    db.prepare("DELETE FROM cms_articles WHERE id = ?").run(id);
    db.prepare(`
      INSERT INTO audit_entries (id, actor_id, action, entity_type, entity_id, changes_json, occurred_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(newId(), userId, "article:delete", "cms_article", id, null, nowIso());
  });

  return true;
}
