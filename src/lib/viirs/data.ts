import "server-only";
import annualJson from "@/data/viirs/annual.json";
import metaJson from "@/data/viirs/meta.json";
import monthlyJson from "@/data/viirs/monthly.json";
import preprocessingJson from "@/data/viirs/preprocessing.json";
import profileJson from "@/data/viirs/profile.json";
import radianceHistJson from "@/data/viirs/radiance-hist.json";
import statsJson from "@/data/viirs/stats.json";
import type {
  ViirsAnnual,
  ViirsMeta,
  ViirsMonthly,
  ViirsPreprocessing,
  ViirsProfile,
  ViirsRadianceHist,
  ViirsStats,
} from "./types";

/**
 * Ringkasan VIIRS statis (dibangun offline dari viirs_clean_all.csv). Grid peta yang besar
 * (density, monthly-grid-2025) tidak diimpor di sini — dilayani lewat /api/viirs/[dataset].
 */
export const viirsMeta = metaJson as unknown as ViirsMeta;
export const viirsPreprocessing = preprocessingJson as unknown as ViirsPreprocessing;
export const viirsProfile = profileJson as unknown as ViirsProfile;
export const viirsRadianceHist = radianceHistJson as unknown as ViirsRadianceHist;
export const viirsAnnual = annualJson as unknown as ViirsAnnual;
export const viirsMonthly = monthlyJson as unknown as ViirsMonthly;
export const viirsStats = statsJson as unknown as ViirsStats;
