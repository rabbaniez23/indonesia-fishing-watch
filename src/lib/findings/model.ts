import { z } from "zod";

/**
 * Model temuan (FR-09) yang aman untuk client: enum, label, transisi status, dan schema input.
 * Prioritas ditetapkan pengguna dengan alasan — bukan probabilitas ilegal.
 */

export const STATUSES = ["baru", "ditinjau", "perlu_informasi", "selesai"] as const;
export type FindingStatus = (typeof STATUSES)[number];

export const PRIORITIES = ["rendah", "sedang", "tinggi"] as const;
export type FindingPriority = (typeof PRIORITIES)[number];

export const STATUS_LABEL: Record<FindingStatus, string> = {
  baru: "Baru",
  ditinjau: "Ditinjau",
  perlu_informasi: "Perlu informasi",
  selesai: "Selesai",
};

export const PRIORITY_LABEL: Record<FindingPriority, string> = { rendah: "Rendah", sedang: "Sedang", tinggi: "Tinggi" };

/**
 * Transisi yang diizinkan. "selesai → ditinjau" = buka kembali (alasan wajib).
 * "Selesai" berarti peninjauan selesai — tidak menyatakan kapal legal/ilegal.
 */
export const TRANSITIONS: Record<FindingStatus, FindingStatus[]> = {
  baru: ["ditinjau"],
  ditinjau: ["perlu_informasi", "selesai"],
  perlu_informasi: ["ditinjau", "selesai"],
  selesai: ["ditinjau"],
};

export function canTransition(from: FindingStatus, to: FindingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Alasan wajib saat membuka kembali temuan yang selesai. */
export function transitionNeedsReason(from: FindingStatus, to: FindingStatus): boolean {
  return from === "selesai" && to === "ditinjau";
}

export function transitionLabel(from: FindingStatus, to: FindingStatus): string {
  if (transitionNeedsReason(from, to)) return "Buka kembali";
  return { ditinjau: "Tandai ditinjau", perlu_informasi: "Perlu informasi", selesai: "Selesaikan peninjauan", baru: "Baru" }[to];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const text = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} minimal ${min} karakter.`)
    .max(max, `${label} maksimal ${max} karakter.`);
const optionalNumber = z.number().finite().nullable().optional();
const optionalString = z.string().max(200).nullable().optional();

/** Snapshot sumber. Field nilai disalin saat disimpan (tidak dibaca ulang dari provider). */
export const sourceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("cell"),
    resultId: z.string().max(64),
    layer: z.enum(["fishingEffort", "presence", "sar"]),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    value: z.number().finite(),
    unit: z.string().max(20),
    datasetResolved: optionalString,
    fetchedAt: optionalString,
  }),
  z.object({
    type: z.literal("vessel"),
    vesselId: z.string().max(80),
    name: optionalString,
    mmsi: optionalString,
    imo: optionalString,
    flag: optionalString,
    datasetResolved: optionalString,
    fetchedAt: optionalString,
  }),
  z.object({
    type: z.literal("event"),
    eventId: z.string().max(120),
    eventType: z.string().max(40),
    start: z.string().max(40),
    end: z.string().max(40),
    vesselId: z.string().max(80),
    vesselName: optionalString,
    lat: optionalNumber,
    lon: optionalNumber,
    portName: optionalString,
    datasetResolved: optionalString,
    fetchedAt: optionalString,
  }),
  z.object({ type: z.literal("manual") }),
]);
export type FindingSource = z.infer<typeof sourceSchema>;

export const filterSnapshotSchema = z.object({
  regionId: z.string().max(64),
  from: z.string().regex(DATE_RE),
  to: z.string().regex(DATE_RE),
});
export type FilterSnapshot = z.infer<typeof filterSnapshotSchema>;

export const createFindingSchema = z.object({
  title: text(3, 160, "Judul"),
  reason: text(10, 4000, "Alasan"),
  priority: z.enum(PRIORITIES),
  priorityReason: text(5, 1000, "Alasan prioritas"),
  source: sourceSchema,
  filter: filterSnapshotSchema,
});
export type CreateFindingInput = z.infer<typeof createFindingSchema>;

export const updateFindingSchema = z
  .object({
    version: z.number().int().positive(),
    status: z.enum(STATUSES).optional(),
    statusReason: z.string().trim().max(2000).optional(),
    priority: z.enum(PRIORITIES).optional(),
    priorityReason: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.status !== undefined || v.priority !== undefined, { message: "Tidak ada perubahan." });
export type UpdateFindingInput = z.infer<typeof updateFindingSchema>;

export const noteSchema = z.object({ body: text(2, 4000, "Catatan") });

export function sourceLabel(source: FindingSource): string {
  switch (source.type) {
    case "cell":
      return "Sel grid peta";
    case "vessel":
      return "Profil kapal";
    case "event":
      return "Kejadian kapal";
    default:
      return "Manual";
  }
}
