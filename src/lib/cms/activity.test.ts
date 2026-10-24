import { describe, expect, it } from "vitest";
import { getDb, newId, nowIso } from "@/lib/db";
import {
  exportActivitiesCsv,
  getActivityStats,
  listActivities,
  resolveActionMeta,
} from "./activity";

describe("CMS Activity Service", () => {
  it("resolves action metadata correctly", () => {
    const metaUpload = resolveActionMeta("dataset:upload");
    expect(metaUpload.category).toBe("dataset");
    expect(metaUpload.label).toBe("Unggah Dataset Riset");

    const metaLayer = resolveActionMeta("layer:create");
    expect(metaLayer.category).toBe("layer");
    expect(metaLayer.label).toBe("Buat Lapisan Peta");

    const metaArticle = resolveActionMeta("article:create");
    expect(metaArticle.category).toBe("article");
    expect(metaArticle.label).toBe("Tulis Artikel Baru");

    const metaUnknown = resolveActionMeta("custom:event");
    expect(metaUnknown.label).toBeDefined();
    expect(metaUnknown.categoryLabel).toBeDefined();
  });

  it("lists paginated activities and filters by category", () => {
    const db = getDb();
    const now = nowIso();
    const testId = newId();

    // Insert mock audit entry
    db.prepare(`
      INSERT INTO audit_entries (id, actor_id, action, entity_type, entity_id, changes_json, occurred_at)
      VALUES (?, NULL, 'dataset:upload', 'research_dataset', ?, '{"name":"Survey Test"}', ?)
    `).run(testId, testId, now);

    const res = listActivities({ category: "dataset", pageSize: 10 });
    expect(res.total).toBeGreaterThanOrEqual(1);
    expect(res.items.some((i) => i.id === testId)).toBe(true);
    const found = res.items.find((i) => i.id === testId);
    expect(found?.actionLabel).toBe("Unggah Dataset Riset");
    expect(found?.changes).toEqual({ name: "Survey Test" });
  });

  it("calculates activity stats including daily trends and breakdown", () => {
    const stats = getActivityStats();
    expect(stats).toBeDefined();
    expect(typeof stats.total30Days).toBe("number");
    expect(typeof stats.totalToday).toBe("number");
    expect(Array.isArray(stats.dailyTrends)).toBe(true);
    expect(stats.dailyTrends.length).toBe(14);
    expect(Array.isArray(stats.categoryBreakdown)).toBe(true);
  });

  it("exports filtered activities to CSV correctly", () => {
    const csv = exportActivitiesCsv({ category: "dataset" });
    expect(csv).toContain("Waktu (UTC)");
    expect(csv).toContain("Aksi");
    expect(csv).toContain("Unggah Dataset Riset");
  });
});
