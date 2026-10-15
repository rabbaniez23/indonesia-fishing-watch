/**
 * Bentuk JSON ringkasan oseanografi (src/data/oseanografi/*.json) — dibangun offline oleh
 * scripts/oseanografi/build_ocean_summary.py dari Copernicus Marine Service. Aman diimpor dari komponen client.
 */

export type OceanVarKey = "sst" | "sss" | "cur" | "ssh" | "mld" | "chl" | "pp" | "zsd" | "no3" | "o2" | "ph" | "wave" | "wind";
/** 11 WPP + "total" (gabungan 11 WPP). */
export type AreaKey = string;

export type OceanVarMeta = {
  key: OceanVarKey;
  label: string;
  unit: string;
  /** series = deret bulanan; climatology = klimatologi model saja; year = satu tahun contoh. */
  kind: "series" | "climatology" | "year";
  log: boolean;
  arrows: boolean;
  dataset: string;
  product: string;
  period: { start?: string; end?: string; climatology?: [number, number]; climatologyBounds?: [string, string] | null; year?: number; strideHours?: number };
};

export type OceanMeta = {
  generatedAt: string;
  wpp: string[];
  climatology: [number, number];
  grid: { res: number; lon0: number; lat0: number; nx: number; ny: number };
  variables: OceanVarMeta[];
  source: string;
};

export type OceanSeries = Partial<Record<OceanVarKey, { months: string[] } & Record<AreaKey, Array<number | null>>>>;

export type SeasonalArea = { mean: Array<number | null>; peak: number | null; low: number | null; amplitude: number | null };
export type OceanSeasonal = Partial<Record<OceanVarKey, Record<AreaKey, SeasonalArea>>>;

export type TrendArea = {
  annual: Array<number | null>;
  tau?: number | null;
  p?: number | null;
  senPerYear?: number | null;
  senPerDecade?: number | null;
  direction?: "up" | "down" | "none";
  significant?: boolean;
};
export type OceanTrends = Partial<Record<OceanVarKey, { years: number[] } & Record<AreaKey, TrendArea>>>;

export type Correlation = { r: number | null; p: number | null; n: number };
export type OceanLink = {
  viirsSeasonal: Record<AreaKey, Array<number | null>>;
  vars: Partial<Record<OceanVarKey, Record<AreaKey, { season: Correlation; anomaly: Correlation | null }>>>;
};

/** Grid 0,25° untuk peta: nilai = int / scale, hanya sel laut (`cells` = indeks iy × nx + ix). */
export type OceanGrid = {
  key: OceanVarKey;
  res: number;
  lon0: number;
  lat0: number;
  nx: number;
  ny: number;
  scale: number;
  log: boolean;
  vmin: number;
  vmax: number;
  latestMonth: string | null;
  cells: number[];
  /** "1".."12" = klimatologi bulan kalender; "latest" = bulan terbaru. */
  frames: Record<string, Array<number | null>>;
  arrows?: {
    res: number;
    nx: number;
    ny: number;
    lon0: number;
    lat0: number;
    scale: number;
    cells: number[];
    frames: Record<string, [Array<number | null>, Array<number | null>]>;
  };
};
