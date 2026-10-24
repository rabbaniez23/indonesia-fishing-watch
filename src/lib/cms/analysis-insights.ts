import { getDb, newId, nowIso, transaction } from "@/lib/db";
import type { SQLInputValue } from "node:sqlite";
import type {
  AnalysisInsight,
  CreateInsightInput,
  InsightKind,
  InsightTab,
  UpdateInsightInput,
} from "./types";

type InsightRow = {
  id: string;
  title: string;
  content: string;
  kind: InsightKind;
  tab: InsightTab;
  region_id: string | null;
  region_name: string | null;
  metric: string;
  period_start: string | null;
  period_end: string | null;
  is_active: number;
  author_id: string;
  author_name: string;
  created_at: string;
  updated_at: string;
};

function rowToInsight(row: InsightRow): AnalysisInsight {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    kind: row.kind,
    tab: row.tab,
    regionId: row.region_id,
    regionName: row.region_name || (row.region_id ? row.region_id : "Semua Wilayah"),
    metric: row.metric,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    isActive: row.is_active === 1,
    author: {
      id: row.author_id,
      name: row.author_name || "Peneliti IFW",
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createAnalysisInsight(input: CreateInsightInput): AnalysisInsight {
  if (!input.title || !input.title.trim()) {
    throw new Error("Judul catatan analisis wajib diisi.");
  }
  if (!input.content || !input.content.trim()) {
    throw new Error("Isi narasi / interpretasi catatan wajib diisi.");
  }

  const db = getDb();
  const id = newId();
  const now = nowIso();
  const isActiveNum = input.isActive !== false ? 1 : 0;
  const metric = input.metric || "semua";
  const regionId = input.regionId && input.regionId !== "all" ? input.regionId : null;

  transaction(db, () => {
    db.prepare(`
      INSERT INTO analysis_insights (
        id, title, content, kind, tab, region_id, metric,
        period_start, period_end, is_active, author_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.title.trim(),
      input.content.trim(),
      input.kind,
      input.tab,
      regionId,
      metric,
      input.periodStart || null,
      input.periodEnd || null,
      isActiveNum,
      input.userId,
      now,
      now,
    );

    // Record audit
    db.prepare(`
      INSERT INTO audit_entries (id, actor_id, action, entity_type, entity_id, changes_json, occurred_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      newId(),
      input.userId,
      "insight:create",
      "analysis_insight",
      id,
      JSON.stringify({
        title: input.title.trim(),
        kind: input.kind,
        tab: input.tab,
        regionId,
      }),
      now,
    );
  });

  return getAnalysisInsightById(id)!;
}

export function updateAnalysisInsight(input: UpdateInsightInput): AnalysisInsight {
  const existing = getAnalysisInsightById(input.id);
  if (!existing) {
    throw new Error("Catatan analisis tidak ditemukan.");
  }

  const db = getDb();
  const now = nowIso();
  const title = input.title !== undefined ? input.title.trim() : existing.title;
  const content = input.content !== undefined ? input.content.trim() : existing.content;
  const kind = input.kind !== undefined ? input.kind : existing.kind;
  const tab = input.tab !== undefined ? input.tab : existing.tab;
  const regionId =
    input.regionId !== undefined
      ? input.regionId === "all" || !input.regionId
        ? null
        : input.regionId
      : existing.regionId;
  const metric = input.metric !== undefined ? input.metric : existing.metric;
  const periodStart =
    input.periodStart !== undefined ? input.periodStart : existing.periodStart;
  const periodEnd =
    input.periodEnd !== undefined ? input.periodEnd : existing.periodEnd;
  const isActiveNum =
    input.isActive !== undefined ? (input.isActive ? 1 : 0) : existing.isActive ? 1 : 0;

  transaction(db, () => {
    db.prepare(`
      UPDATE analysis_insights
      SET title = ?, content = ?, kind = ?, tab = ?, region_id = ?, metric = ?,
          period_start = ?, period_end = ?, is_active = ?, updated_at = ?
      WHERE id = ?
    `).run(
      title,
      content,
      kind,
      tab,
      regionId,
      metric,
      periodStart,
      periodEnd,
      isActiveNum,
      now,
      input.id,
    );

    // Record audit
    db.prepare(`
      INSERT INTO audit_entries (id, actor_id, action, entity_type, entity_id, changes_json, occurred_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      newId(),
      input.userId,
      "insight:update",
      "analysis_insight",
      input.id,
      JSON.stringify({
        title,
        kind,
        tab,
        isActive: isActiveNum === 1,
      }),
      now,
    );
  });

  return getAnalysisInsightById(input.id)!;
}

export function deleteAnalysisInsight(id: string, userId: string): boolean {
  const existing = getAnalysisInsightById(id);
  if (!existing) return false;

  const db = getDb();
  const now = nowIso();

  transaction(db, () => {
    db.prepare("DELETE FROM analysis_insights WHERE id = ?").run(id);

    db.prepare(`
      INSERT INTO audit_entries (id, actor_id, action, entity_type, entity_id, changes_json, occurred_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      newId(),
      userId,
      "insight:delete",
      "analysis_insight",
      id,
      JSON.stringify({ title: existing.title }),
      now,
    );
  });

  return true;
}

export function getAnalysisInsightById(id: string): AnalysisInsight | null {
  const db = getDb();
  const row = db
    .prepare(`
      SELECT i.*, u.name as author_name, r.name as region_name
      FROM analysis_insights i
      LEFT JOIN users u ON u.id = i.author_id
      LEFT JOIN regions r ON r.id = i.region_id
      WHERE i.id = ?
    `)
    .get(id) as InsightRow | undefined;

  return row ? rowToInsight(row) : null;
}

export function listAnalysisInsights(filter?: {
  tab?: InsightTab;
  regionId?: string;
  isActive?: boolean;
}): AnalysisInsight[] {
  const db = getDb();
  let query = `
    SELECT i.*, u.name as author_name, r.name as region_name
    FROM analysis_insights i
    LEFT JOIN users u ON u.id = i.author_id
    LEFT JOIN regions r ON r.id = i.region_id
  `;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter?.tab && filter.tab !== "semua") {
    conditions.push("i.tab = ?");
    params.push(filter.tab);
  }
  if (filter?.regionId && filter.regionId !== "all") {
    conditions.push("i.region_id = ?");
    params.push(filter.regionId);
  }
  if (filter?.isActive !== undefined) {
    conditions.push("i.is_active = ?");
    params.push(filter.isActive ? 1 : 0);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  query += " ORDER BY i.updated_at DESC";

  const rows = db.prepare(query).all(...(params as SQLInputValue[])) as InsightRow[];
  return rows.map(rowToInsight);
}

/**
 * Mengambil insight aktif yang relevan untuk halaman /analysis publik.
 * Otomatis mencocokkan tab yang sedang dibuka ('tren', 'kapal', dll) atau 'semua',
 * dan region yang dipilih (atau catatan umum berskala nasional / region IS NULL).
 */
export function getActiveInsightsForAnalysis(params: {
  tab: string;
  regionId?: string;
  metric?: string;
}): AnalysisInsight[] {
  const db = getDb();
  const query = `
    SELECT i.*, u.name as author_name, r.name as region_name
    FROM analysis_insights i
    LEFT JOIN users u ON u.id = i.author_id
    LEFT JOIN regions r ON r.id = i.region_id
    WHERE i.is_active = 1
      AND (i.tab = 'semua' OR i.tab = ?)
      AND (i.region_id IS NULL OR i.region_id = ?)
      AND (i.metric = 'semua' OR ? IS NULL OR i.metric = ?)
    ORDER BY
      CASE WHEN i.region_id IS NOT NULL THEN 0 ELSE 1 END,
      CASE WHEN i.tab != 'semua' THEN 0 ELSE 1 END,
      i.created_at DESC
  `;

  const rows = db
    .prepare(query)
    .all(params.tab, params.regionId || null, params.metric || null, params.metric || null) as InsightRow[];

  return rows.map(rowToInsight);
}
