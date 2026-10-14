/**
 * Bentuk JSON ringkasan VIIRS Boat Detection (src/data/viirs/*.json), dihasilkan offline oleh
 * scripts/viirs/build_viirs_summary.py dan build_viirs_stats.py. Aman diimpor dari komponen client.
 */

export type RadianceClass = "low" | "medium" | "high";
export const RADIANCE_CLASSES: RadianceClass[] = ["low", "medium", "high"];

export type ViirsMeta = {
  generatedAt: string;
  source: { file: string; rows: number; producer: string; dataset: string };
  dateRange: { start: string; end: string };
  filters: string[];
  classes: Record<RadianceClass, { label: string; rule: string }>;
  radianceUnit: string;
  wpp: string[];
  years: number[];
  monthsByYear: Record<string, number[]>;
  trendYears: [number, number];
};

export type ViirsPreprocessing = {
  paperTable2: {
    raw: { records: number; attributes: number; sizeGb: number };
    postCleaning: { records: number; attributes: number; sizeGb: number };
    analytical: { records: number };
  };
  steps: Array<{ id: string; label: string; records: number }>;
  qfDetect: Record<string, number>;
  landMask: Record<string, number>;
  notes: {
    duplicates: number;
    duplicatesInFinal: number;
    nonPositiveRadiance: number;
    nonPositiveRadianceInFinal: number;
    invalidRows: number;
  };
};

export type ProfileRow = {
  n: number;
  median: number | null;
  mean: number | null;
  sd: number | null;
  share: number | null;
  classes: Record<RadianceClass, number>;
  classPct: Record<RadianceClass, number | null>;
};
export type ViirsProfile = { total: ProfileRow; wpp: Record<string, ProfileRow> };

export type ViirsRadianceHist = {
  edges: number[];
  counts: number[];
  median: number;
  thresholds: [number, number];
  excludedNonPositive: number;
};

export type AnnualByClass = Record<RadianceClass | "all", number[]>;
export type ViirsAnnual = { years: number[]; total: AnnualByClass; wpp: Record<string, AnnualByClass> };

export type ViirsMonthly = { months: string[]; total: number[]; wpp: Record<string, number[]> };

/** Sel grid: [ix, iy, ...nilai]; pusat sel = lon0 + (ix + 0,5) × res. */
export type GridCell = number[];
export type ViirsDensity = { res: number; lon0: number; lat0: number; columns: string[]; cells: GridCell[] };
export type ViirsMonthlyGrid = {
  year: number;
  res: number;
  lon0: number;
  lat0: number;
  columns: string[];
  wpp: Record<string, { monthTotals: number[]; cells: GridCell[] }>;
};

export type TrendStat = {
  values: number[];
  loess: Array<number | null>;
  mean: number | null;
  sd: number | null;
  cv: number | null;
  cvClass: "stable" | "moderate" | "high";
  S: number;
  z: number | null;
  tau: number | null;
  p: number | null;
  senSlope: number | null;
  direction: "up" | "down" | "none";
  significant: boolean;
};

export type SeasonalStat = {
  seasonalIndex: Array<number | null>;
  monthlyMean: Array<number | null>;
  peakMonth: number;
  lowMonth: number;
  amplitude: number | null;
};

export type ErrorMetrics = { rmse: number | null; mape: number | null; mae: number | null };
export type DmResult = { dm: number | null; p: number | null; significant: boolean };

export type ForecastStat = {
  months: string[];
  actual: number[];
  trainEnd: string;
  test: { months: string[]; sarima: Array<number | null>; ets: Array<number | null> };
  future: { months: string[]; sarima: Array<number | null>; ets: Array<number | null> };
  models: {
    sarima: { order: number[]; seasonalOrder: number[]; aic: number | null };
    ets: { error: string; trend: string | null; damped: boolean; seasonal: string; aic: number | null };
  };
  metrics: { sarima: ErrorMetrics; ets: ErrorMetrics };
  dm: { mape: DmResult; rmse: DmResult };
};

export type ViirsStats = {
  params: {
    trendYears: [number, number];
    alpha: number;
    loessFrac: number;
    cvClasses: Record<"stable" | "moderate" | "high", string>;
    seasonalRange: [string, string];
    stl: { period: number; robust: boolean };
    forecast: { train: [string, string]; test: [string, string]; horizonEnd: string; sarimaGrid: string; etsGrid: string; dm: string };
  };
  trend: Record<string, TrendStat>;
  seasonal: Record<string, SeasonalStat>;
  forecast: Record<string, ForecastStat>;
};
