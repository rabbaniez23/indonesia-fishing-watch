import { getDb } from "@/lib/db";
import type {
  ActivityCategory,
  ActivityCategoryCount,
  ActivityContributor,
  ActivityDailyCount,
  ActivityEntry,
  ActivityFilterParams,
  ActivityStats,
  PaginatedActivities,
} from "./types";
import { ACTIVITY_CATEGORY_LABELS } from "./types";
import type { SQLInputValue } from "node:sqlite";

const ACTION_LABELS: Record<string, { label: string; category: Exclude<ActivityCategory, "all"> }> = {
  // Data Riset
  "dataset:upload": { label: "Unggah Dataset Riset", category: "dataset" },
  "dataset:delete": { label: "Hapus Dataset Riset", category: "dataset" },
  "dataset.import": { label: "Impor Data Riset", category: "dataset" },

  // Lapisan Peta
  "layer:create": { label: "Buat Lapisan Peta", category: "layer" },
  "layer:update": { label: "Perbarui Lapisan Peta", category: "layer" },
  "layer:delete": { label: "Hapus Lapisan Peta", category: "layer" },

  // Artikel & Konten
  "article:create": { label: "Tulis Artikel Baru", category: "article" },
  "article:update": { label: "Perbarui Konten Artikel", category: "article" },
  "article:delete": { label: "Hapus Artikel", category: "article" },
  "insight:create": { label: "Tulis Catatan Analisis", category: "article" },
  "insight:update": { label: "Perbarui Catatan Analisis", category: "article" },
  "insight:delete": { label: "Hapus Catatan Analisis", category: "article" },

  // Temuan Riset & Patroli
  "finding.create": { label: "Buat Temuan Lapangan", category: "finding" },
  "finding.update": { label: "Perbarui Status Temuan", category: "finding" },
  "finding.note": { label: "Tambah Catatan Temuan", category: "finding" },

  // Laporan
  "report.create": { label: "Buat Laporan Ekspor", category: "report" },
  "report.download": { label: "Unduh Laporan", category: "report" },

  // Sesi & Akun Pengguna
  "session.login": { label: "Masuk Akun (Login)", category: "auth" },
  "session.logout": { label: "Keluar Akun (Logout)", category: "auth" },
  "user.create": { label: "Buat Akun Pengguna", category: "auth" },
  "user.update": { label: "Perbarui Akun Pengguna", category: "auth" },
  "invite.create": { label: "Kirim Undangan Pengguna", category: "auth" },
  "invite.accept": { label: "Aktivasi Akun Undangan", category: "auth" },
  "invite.revoke": { label: "Cabut Undangan", category: "auth" },

  // Sistem & Pengaturan
  "settings.update": { label: "Perbarui Pengaturan Sistem", category: "system" },
};

export function resolveActionMeta(action: string): {
  label: string;
  category: Exclude<ActivityCategory, "all">;
  categoryLabel: string;
} {
  const defined = ACTION_LABELS[action];
  if (defined) {
    return {
      label: defined.label,
      category: defined.category,
      categoryLabel: ACTIVITY_CATEGORY_LABELS[defined.category],
    };
  }

  // Fallback heuristic based on prefix
  let category: Exclude<ActivityCategory, "all"> = "system";
  if (action.startsWith("dataset")) category = "dataset";
  else if (action.startsWith("layer")) category = "layer";
  else if (action.startsWith("article")) category = "article";
  else if (action.startsWith("finding")) category = "finding";
  else if (action.startsWith("report")) category = "report";
  else if (action.startsWith("session") || action.startsWith("user") || action.startsWith("invite"))
    category = "auth";

  const label = action
    .replace(/[:._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    label,
    category,
    categoryLabel: ACTIVITY_CATEGORY_LABELS[category],
  };
}

type RawAuditRow = {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  changes_json: string | null;
  occurred_at: string;
};

function formatDayLabel(dateStr: string): string {
  try {
    const parts = dateStr.split("-");
    const day = parseInt(parts[2], 10);
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "Mei",
      "Jun",
      "Jul",
      "Agu",
      "Sep",
      "Okt",
      "Nov",
      "Des",
    ];
    const month = months[parseInt(parts[1], 10) - 1] || parts[1];
    return `${day} ${month}`;
  } catch {
    return dateStr;
  }
}

function buildFilterWhereClause(params: ActivityFilterParams): {
  where: string;
  args: unknown[];
} {
  const conditions: string[] = [];
  const args: unknown[] = [];

  // Filter Kategori
  if (params.category && params.category !== "all") {
    switch (params.category) {
      case "dataset":
        conditions.push("(a.action LIKE 'dataset:%' OR a.action LIKE 'dataset.%')");
        break;
      case "layer":
        conditions.push("(a.action LIKE 'layer:%' OR a.action LIKE 'layer.%')");
        break;
      case "article":
        conditions.push("(a.action LIKE 'article:%' OR a.action LIKE 'article.%')");
        break;
      case "finding":
        conditions.push("(a.action LIKE 'finding:%' OR a.action LIKE 'finding.%')");
        break;
      case "report":
        conditions.push("(a.action LIKE 'report:%' OR a.action LIKE 'report.%')");
        break;
      case "auth":
        conditions.push(
          "(a.action LIKE 'session.%' OR a.action LIKE 'user.%' OR a.action LIKE 'invite.%')",
        );
        break;
      case "system":
        conditions.push("(a.action LIKE 'settings.%' OR a.action NOT LIKE '%:%')");
        break;
    }
  }

  // Filter Rentang Waktu
  if (params.timeRange && params.timeRange !== "all") {
    const now = new Date();
    if (params.timeRange === "today") {
      const todayIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
      conditions.push("a.occurred_at >= ?");
      args.push(todayIso);
    } else if (params.timeRange === "7d") {
      const past7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      conditions.push("a.occurred_at >= ?");
      args.push(past7d);
    } else if (params.timeRange === "30d") {
      const past30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      conditions.push("a.occurred_at >= ?");
      args.push(past30d);
    }
  }

  // Filter Aktor
  if (params.actorId) {
    conditions.push("a.actor_id = ?");
    args.push(params.actorId);
  }

  // Pencarian Teks
  if (params.search && params.search.trim()) {
    const term = `%${params.search.trim().toLowerCase()}%`;
    conditions.push(
      "(LOWER(a.action) LIKE ? OR LOWER(COALESCE(u.name, '')) LIKE ? OR LOWER(COALESCE(u.email, '')) LIKE ? OR LOWER(COALESCE(a.entity_id, '')) LIKE ? OR LOWER(COALESCE(a.changes_json, '')) LIKE ?)",
    );
    args.push(term, term, term, term, term);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, args };
}

export function listActivities(params: ActivityFilterParams = {}): PaginatedActivities {
  const db = getDb();
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const offset = (page - 1) * pageSize;

  const { where, args } = buildFilterWhereClause(params);

  // Hitung total
  const countRow = db
    .prepare(
      `SELECT COUNT(*) as total
       FROM audit_entries a
       LEFT JOIN users u ON u.id = a.actor_id
       ${where}`,
    )
    .get(...(args as SQLInputValue[])) as { total: number };

  const total = countRow?.total || 0;
  const totalPages = Math.ceil(total / pageSize) || 1;

  // Ambil data halaman
  const rows = db
    .prepare(
      `SELECT a.id, a.actor_id, a.action, a.entity_type, a.entity_id, a.changes_json, a.occurred_at,
              u.name as actor_name, u.email as actor_email, u.role as actor_role
       FROM audit_entries a
       LEFT JOIN users u ON u.id = a.actor_id
       ${where}
       ORDER BY a.occurred_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...(args as SQLInputValue[]), pageSize, offset) as RawAuditRow[];

  const items: ActivityEntry[] = rows.map((r) => {
    const meta = resolveActionMeta(r.action);
    let changes: Record<string, unknown> | null = null;
    if (r.changes_json) {
      try {
        changes = JSON.parse(r.changes_json);
      } catch {
        changes = { raw: r.changes_json };
      }
    }

    return {
      id: r.id,
      actorId: r.actor_id,
      actorName: r.actor_name || (r.actor_id ? "Pengguna Terdaftar" : "Sistem / Tamu"),
      actorEmail: r.actor_email,
      actorRole: r.actor_role,
      action: r.action,
      actionLabel: meta.label,
      category: meta.category,
      categoryLabel: meta.categoryLabel,
      entityType: r.entity_type,
      entityId: r.entity_id,
      changes,
      occurredAt: r.occurred_at,
    };
  });

  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
  };
}

export function getActivityStats(): ActivityStats {
  const db = getDb();
  const now = new Date();

  // Waktu 30 hari lalu dan awal hari ini UTC
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();

  // 1. Total 30 hari
  const total30Row = db
    .prepare(
      `SELECT COUNT(*) as count FROM audit_entries WHERE occurred_at >= ?`,
    )
    .get(thirtyDaysAgo) as { count: number };
  const total30Days = total30Row?.count || 0;

  // 2. Total hari ini
  const totalTodayRow = db
    .prepare(
      `SELECT COUNT(*) as count FROM audit_entries WHERE occurred_at >= ?`,
    )
    .get(todayStart) as { count: number };
  const totalToday = totalTodayRow?.count || 0;

  // 3. Aksi Riset & Konten (dataset + layer + article)
  const researchRow = db
    .prepare(
      `SELECT COUNT(*) as count FROM audit_entries 
       WHERE occurred_at >= ? 
       AND (action LIKE 'dataset:%' OR action LIKE 'dataset.%' OR action LIKE 'layer:%' OR action LIKE 'article:%')`,
    )
    .get(thirtyDaysAgo) as { count: number };
  const researchActionsCount = researchRow?.count || 0;

  // 4. Daily Trends 14 hari terakhir
  const dailyCountsMap = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateKey = d.toISOString().split("T")[0];
    dailyCountsMap.set(dateKey, 0);
  }

  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const trendRows = db
    .prepare(
      `SELECT SUBSTR(occurred_at, 1, 10) as day_date, COUNT(*) as count
       FROM audit_entries
       WHERE occurred_at >= ?
       GROUP BY SUBSTR(occurred_at, 1, 10)
       ORDER BY day_date ASC`,
    )
    .all(fourteenDaysAgo) as Array<{ day_date: string; count: number }>;

  for (const r of trendRows) {
    if (dailyCountsMap.has(r.day_date)) {
      dailyCountsMap.set(r.day_date, r.count);
    }
  }

  const dailyTrends: ActivityDailyCount[] = Array.from(dailyCountsMap.entries()).map(
    ([date, count]) => ({
      date,
      label: formatDayLabel(date),
      count,
    }),
  );

  // 5. Category Breakdown dalam 30 hari
  const categoryStatsMap = new Map<Exclude<ActivityCategory, "all">, number>([
    ["dataset", 0],
    ["layer", 0],
    ["article", 0],
    ["finding", 0],
    ["report", 0],
    ["auth", 0],
    ["system", 0],
  ]);

  const recentRows = db
    .prepare(
      `SELECT action FROM audit_entries WHERE occurred_at >= ?`,
    )
    .all(thirtyDaysAgo) as Array<{ action: string }>;

  for (const r of recentRows) {
    const meta = resolveActionMeta(r.action);
    const curr = categoryStatsMap.get(meta.category) || 0;
    categoryStatsMap.set(meta.category, curr + 1);
  }

  const categoryBreakdown: ActivityCategoryCount[] = Array.from(categoryStatsMap.entries())
    .map(([cat, count]) => ({
      category: cat,
      label: ACTIVITY_CATEGORY_LABELS[cat],
      count,
      percentage: total30Days > 0 ? Math.round((count / total30Days) * 100) : 0,
    }))
    .filter((item) => item.count > 0 || item.category === "dataset" || item.category === "layer" || item.category === "article");

  // 6. Top Kontributor Aktif
  const contributorRows = db
    .prepare(
      `SELECT a.actor_id, u.name, u.email, u.role, COUNT(*) as count
       FROM audit_entries a
       JOIN users u ON u.id = a.actor_id
       WHERE a.occurred_at >= ?
       GROUP BY a.actor_id
       ORDER BY count DESC
       LIMIT 5`,
    )
    .all(thirtyDaysAgo) as Array<{
      actor_id: string;
      name: string;
      email: string;
      role: string;
      count: number;
    }>;

  const topContributors: ActivityContributor[] = contributorRows.map((c) => ({
    actorId: c.actor_id,
    name: c.name,
    email: c.email,
    role: c.role,
    count: c.count,
  }));

  return {
    total30Days,
    totalToday,
    researchActionsCount,
    dailyTrends,
    categoryBreakdown,
    topContributors,
  };
}

export function exportActivitiesCsv(params: ActivityFilterParams = {}): string {
  const db = getDb();
  const { where, args } = buildFilterWhereClause(params);

  const rows = db
    .prepare(
      `SELECT a.id, a.actor_id, a.action, a.entity_type, a.entity_id, a.changes_json, a.occurred_at,
              u.name as actor_name, u.email as actor_email, u.role as actor_role
       FROM audit_entries a
       LEFT JOIN users u ON u.id = a.actor_id
       ${where}
       ORDER BY a.occurred_at DESC
       LIMIT 5000`,
    )
    .all(...(args as SQLInputValue[])) as RawAuditRow[];

  function escapeCsv(val: string | null | undefined): string {
    if (!val) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  }

  const headers = [
    "Waktu (UTC)",
    "Aktor",
    "Email",
    "Peran",
    "Kategori",
    "Aksi",
    "Label Aksi",
    "Tipe Entitas",
    "ID Entitas",
    "Perubahan",
  ];

  const lines = [headers.join(",")];

  for (const r of rows) {
    const meta = resolveActionMeta(r.action);
    let changesText = "";
    if (r.changes_json) {
      try {
        const parsed = JSON.parse(r.changes_json);
        changesText = Object.entries(parsed)
          .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
          .join(" | ");
      } catch {
        changesText = r.changes_json;
      }
    }

    lines.push(
      [
        escapeCsv(r.occurred_at),
        escapeCsv(r.actor_name || "Sistem / Tamu"),
        escapeCsv(r.actor_email || "-"),
        escapeCsv(r.actor_role || "-"),
        escapeCsv(meta.categoryLabel),
        escapeCsv(r.action),
        escapeCsv(meta.label),
        escapeCsv(r.entity_type),
        escapeCsv(r.entity_id || "-"),
        escapeCsv(changesText),
      ].join(","),
    );
  }

  return lines.join("\r\n");
}
