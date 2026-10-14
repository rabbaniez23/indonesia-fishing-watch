import { z } from "zod";

/** Model laporan (FR-10), aman untuk client. MVP: CSV dalam ZIP (data.csv + metadata.csv). */

export const REPORT_TYPES = ["ringkasan_harian", "sel_grid", "kunjungan_pelabuhan", "kejadian_kapal"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  ringkasan_harian: "Angka harian (penangkapan ikan, kehadiran kapal, radar)",
  sel_grid: "Lokasi aktivitas (kotak peta ±11 km)",
  kunjungan_pelabuhan: "Kunjungan per pelabuhan",
  kejadian_kapal: "Riwayat kegiatan satu kapal",
};

export const REPORT_STATUSES = ["antre", "diproses", "siap", "gagal"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = { antre: "Menunggu", diproses: "Sedang dibuat", siap: "Siap", gagal: "Gagal" };

/** Masa simpan file laporan. */
export const REPORT_TTL_DAYS = 7;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const period = { regionId: z.string().min(1).max(64), from: z.string().regex(DATE_RE), to: z.string().regex(DATE_RE) };

export const createReportSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ringkasan_harian"), ...period }),
  z.object({ type: z.literal("sel_grid"), layer: z.enum(["fishingEffort", "presence", "sar"]), ...period }),
  z.object({ type: z.literal("kunjungan_pelabuhan"), ...period }),
  z.object({
    type: z.literal("kejadian_kapal"),
    vesselId: z.string().regex(/^[0-9a-f][0-9a-f-]{8,63}$/i, "ID kapal GFW tidak valid."),
    kinds: z.array(z.enum(["fishing", "encounter", "loitering", "port_visit"])).min(1).max(4),
    ...period,
  }),
]);
export type CreateReportInput = z.infer<typeof createReportSchema>;

export const createReportRequestSchema = z.object({
  idempotencyKey: z.string().min(8).max(80),
  params: createReportSchema,
});
