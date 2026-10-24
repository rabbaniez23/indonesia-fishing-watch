export const DATASET_CATEGORIES = [
  "vessel_sightings",
  "viirs_update",
  "ocean_survey",
  "custom_layer",
  "other",
] as const;

export type DatasetCategory = (typeof DATASET_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<DatasetCategory, string> = {
  vessel_sightings: "Pengamatan Kapal Lapangan",
  viirs_update: "Pembaruan Satelit VIIRS",
  ocean_survey: "Survei Oseanografi",
  custom_layer: "Lapisan Peta Kustom",
  other: "Lainnya",
};

export type ResearchDataset = {
  id: string;
  name: string;
  category: DatasetCategory;
  description: string | null;
  fileName: string;
  fileType: "csv" | "geojson" | "json";
  fileSize: number;
  rowCount: number;
  columns: string[];
  previewRows: Array<Record<string, unknown>>;
  summary: {
    hasCoordinates: boolean;
    coordColumns?: { lat: string; lon: string };
    validCoordinatesCount?: number;
    hasDate: boolean;
    dateColumn?: string;
    bbox?: [number, number, number, number];
    featureTypes?: string[];
    description: string;
  };
  status: "validating" | "ready" | "failed" | "archived";
  errorMessage: string | null;
  uploadedBy: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type ValidationResult = {
  valid: boolean;
  fileType: "csv" | "geojson" | "json";
  rowCount: number;
  columns: string[];
  previewRows: Array<Record<string, unknown>>;
  summary: ResearchDataset["summary"];
  warnings: string[];
  errorMessage?: string;
};

export type CustomMapLayer = {
  id: string;
  datasetId: string;
  datasetName: string;
  name: string;
  description: string | null;
  layerType: "point" | "line" | "polygon";
  color: string;
  strokeColor: string | null;
  opacity: number;
  isVisible: boolean;
  featureCount: number;
  createdBy: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
};

export const ARTICLE_CATEGORIES = [
  "panduan",
  "analisis",
  "oseanografi",
  "metodologi",
  "buletin",
  "lainnya",
] as const;

export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number];

export const ARTICLE_CATEGORY_LABELS: Record<ArticleCategory, string> = {
  panduan: "Panduan Sistem",
  analisis: "Analisis Maritim",
  oseanografi: "Edukasi Oseanografi",
  metodologi: "Metodologi & Data",
  buletin: "Buletin Bulanan",
  lainnya: "Lainnya",
};

export type ArticleStatus = "draft" | "published" | "archived";

export type CmsArticle = {
  id: string;
  title: string;
  slug: string;
  category: ArticleCategory;
  excerpt: string | null;
  contentHtml: string;
  coverImage: string | null;
  status: ArticleStatus;
  author: {
    id: string;
    name: string;
  };
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const ACTIVITY_CATEGORIES = [
  "all",
  "dataset",
  "layer",
  "article",
  "finding",
  "report",
  "auth",
  "system",
] as const;

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export const ACTIVITY_CATEGORY_LABELS: Record<ActivityCategory, string> = {
  all: "Semua Kategori",
  dataset: "Data Riset",
  layer: "Lapisan Peta",
  article: "Artikel & Konten",
  finding: "Temuan Riset",
  report: "Laporan Ekspor",
  auth: "Sesi & Pengguna",
  system: "Sistem & Pengaturan",
};

export type ActivityEntry = {
  id: string;
  actorId: string | null;
  actorName: string;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  actionLabel: string;
  category: Exclude<ActivityCategory, "all">;
  categoryLabel: string;
  entityType: string;
  entityId: string | null;
  changes: Record<string, unknown> | null;
  occurredAt: string;
};

export type ActivityDailyCount = {
  date: string;
  label: string;
  count: number;
};

export type ActivityCategoryCount = {
  category: Exclude<ActivityCategory, "all">;
  label: string;
  count: number;
  percentage: number;
};

export type ActivityContributor = {
  actorId: string;
  name: string;
  email: string | null;
  role: string | null;
  count: number;
};

export type ActivityStats = {
  total30Days: number;
  totalToday: number;
  researchActionsCount: number;
  dailyTrends: ActivityDailyCount[];
  categoryBreakdown: ActivityCategoryCount[];
  topContributors: ActivityContributor[];
};

export type ActivityFilterParams = {
  category?: ActivityCategory;
  timeRange?: "all" | "today" | "7d" | "30d";
  actorId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type PaginatedActivities = {
  items: ActivityEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export const INSIGHT_KINDS = [
  "interpretasi",
  "temuan",
  "peringatan",
  "rekomendasi",
] as const;

export type InsightKind = (typeof INSIGHT_KINDS)[number];

export const INSIGHT_KIND_LABELS: Record<
  InsightKind,
  { label: string; description: string; tone: "info" | "warning" | "error" | "success" }
> = {
  interpretasi: {
    label: "Interpretasi Tren",
    description: "Konteks musim, fluktuasi oseanografi, atau pola naik-turun aktivitas",
    tone: "info",
  },
  temuan: {
    label: "Temuan Lapangan",
    description: "Observasi armada tertentu, kapal asing, atau anomali perikanan",
    tone: "success",
  },
  peringatan: {
    label: "Peringatan Khusus",
    description: "Area rawan pelanggaran IUU, keterbatasan sensor radar satelit",
    tone: "warning",
  },
  rekomendasi: {
    label: "Rekomendasi Kebijakan",
    description: "Saran patroli terarah atau fokus pemantauan antar-instansi",
    tone: "info",
  },
};

export const INSIGHT_TABS = [
  "semua",
  "tren",
  "kapal",
  "hotspot",
  "wpp",
  "kejadian",
  "perbandingan",
] as const;

export type InsightTab = (typeof INSIGHT_TABS)[number];

export const INSIGHT_TAB_LABELS: Record<InsightTab, string> = {
  semua: "Semua Bagian Analisis",
  tren: "Naik-Turun (Tren)",
  kapal: "Kapal & Alat Tangkap",
  hotspot: "Lokasi Teramai (Hotspot)",
  wpp: "Peringkat Antar-WPP",
  kejadian: "Kejadian di Laut",
  perbandingan: "Perbandingan",
};

export type AnalysisInsight = {
  id: string;
  title: string;
  content: string;
  kind: InsightKind;
  tab: InsightTab;
  regionId: string | null;
  regionName: string | null;
  metric: string;
  periodStart: string | null;
  periodEnd: string | null;
  isActive: boolean;
  author: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type CreateInsightInput = {
  title: string;
  content: string;
  kind: InsightKind;
  tab: InsightTab;
  regionId?: string | null;
  metric?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  isActive?: boolean;
  userId: string;
};

export type UpdateInsightInput = {
  id: string;
  title?: string;
  content?: string;
  kind?: InsightKind;
  tab?: InsightTab;
  regionId?: string | null;
  metric?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  isActive?: boolean;
  userId: string;
};
