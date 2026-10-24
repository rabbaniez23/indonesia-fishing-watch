import { beforeEach, describe, expect, it } from "vitest";
import { openDatabase, setDbForTesting } from "@/lib/db";
import {
  createAnalysisInsight,
  deleteAnalysisInsight,
  getActiveInsightsForAnalysis,
  getAnalysisInsightById,
  listAnalysisInsights,
  updateAnalysisInsight,
} from "./analysis-insights";

describe("CMS Analysis Insights Service", () => {
  const testUserId = "u1";

  beforeEach(() => {
    const db = openDatabase(":memory:");
    setDbForTesting(db);
    db.prepare(`
      INSERT INTO users (id, email, name, role, password_hash, status, created_at, updated_at)
      VALUES ('u1', 'peneliti@kkp.go.id', 'Dr. Peneliti Maritim', 'analyst', 'hash123', 'active', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z')
    `).run();
  });

  it("creates a new analysis insight with audit log", () => {
    const insight = createAnalysisInsight({
      title: "Pola Musim Angin Barat Natuna",
      content: "Penurunan aktivitas penangkapan sebesar 35% akibat gelombang tinggi di Natuna Utara.",
      kind: "interpretasi",
      tab: "tren",
      metric: "fishingEffort",
      isActive: true,
      userId: testUserId,
    });

    expect(insight).toBeDefined();
    expect(insight.title).toBe("Pola Musim Angin Barat Natuna");
    expect(insight.kind).toBe("interpretasi");
    expect(insight.tab).toBe("tren");
    expect(insight.isActive).toBe(true);

    const list = listAnalysisInsights();
    expect(list.some((i) => i.id === insight.id)).toBe(true);
  });

  it("lists insights with tab filter", () => {
    createAnalysisInsight({
      title: "Pola Musim Angin Barat Natuna",
      content: "Penurunan aktivitas penangkapan sebesar 35% akibat gelombang tinggi di Natuna Utara.",
      kind: "interpretasi",
      tab: "tren",
      metric: "fishingEffort",
      isActive: true,
      userId: testUserId,
    });

    const list = listAnalysisInsights({ tab: "tren" });
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(1);
    expect(list[0].title).toBe("Pola Musim Angin Barat Natuna");
  });

  it("matches relevant active insights for public /analysis page", () => {
    createAnalysisInsight({
      title: "Pola Musim Angin Barat Natuna",
      content: "Penurunan aktivitas penangkapan sebesar 35% akibat gelombang tinggi di Natuna Utara.",
      kind: "interpretasi",
      tab: "tren",
      metric: "fishingEffort",
      isActive: true,
      userId: testUserId,
    });

    const matched = getActiveInsightsForAnalysis({
      tab: "tren",
      metric: "fishingEffort",
    });

    expect(matched.length).toBe(1);
    expect(matched[0].title).toBe("Pola Musim Angin Barat Natuna");

    // Tab tidak cocok
    const notMatched = getActiveInsightsForAnalysis({
      tab: "hotspot",
      metric: "fishingEffort",
    });
    expect(notMatched.length).toBe(0);
  });

  it("updates and deletes insight correctly", () => {
    const created = createAnalysisInsight({
      title: "Catatan Uji Coba Sementara",
      content: "Akan segera dihapus setelah pengujian.",
      kind: "peringatan",
      tab: "kapal",
      userId: testUserId,
    });

    const updated = updateAnalysisInsight({
      id: created.id,
      title: "Catatan Uji Coba Diperbarui",
      isActive: false,
      userId: testUserId,
    });
    expect(updated.title).toBe("Catatan Uji Coba Diperbarui");
    expect(updated.isActive).toBe(false);

    const deleted = deleteAnalysisInsight(created.id, testUserId);
    expect(deleted).toBe(true);
    expect(getAnalysisInsightById(created.id)).toBeNull();
  });
});
