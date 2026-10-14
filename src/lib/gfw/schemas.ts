import { z } from "zod";

/**
 * Schema respons GFW berdasarkan fixture nyata (fixtures/gfw/*, diambil 13 Okt 2026).
 * Prinsip: field yang tidak selalu ada → optional/nullable; nilai yang kadang string → dikonversi;
 * field tak dikenal dibuang. Normalizer tidak pernah mengisi nilai tebakan.
 */

const nullableString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v === undefined || v === null || v === "" ? null : v));

/** Angka yang kadang dikirim sebagai string (mis. distanceFromShoreKm: "2"). */
const looseNumber = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  });

const stringArray = z
  .array(z.union([z.string(), z.number()]))
  .optional()
  .transform((v) => (v ?? []).map(String));

// ---------------------------------------------------------------------------
// Regions (context layers)
// ---------------------------------------------------------------------------

export const eezRegionSchema = z.object({
  id: z.number(),
  label: z.string(),
  iso3: nullableString,
  territory1: nullableString,
});
export const eezRegionListSchema = z.array(eezRegionSchema);
export type EezRegion = z.infer<typeof eezRegionSchema>;

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

const eventVesselSchema = z.object({
  id: z.string(),
  name: nullableString,
  ssvid: nullableString,
  flag: nullableString,
  type: nullableString,
});

const anchorageSchema = z.object({
  anchorageId: nullableString,
  /** ID pelabuhan GFW, mis. "idn-tarakan" — bukan kode resmi nasional. */
  id: nullableString,
  name: nullableString,
  flag: nullableString,
  topDestination: nullableString,
  atDock: z.boolean().nullable().optional().transform((v) => v ?? null),
  distanceFromShoreKm: looseNumber,
  lat: looseNumber,
  lon: looseNumber,
});

const rawEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  start: z.string(),
  end: z.string(),
  position: z.object({ lat: looseNumber, lon: looseNumber }).nullable().optional(),
  regions: z.object({ eez: stringArray }).partial().nullable().optional(),
  distances: z
    .object({
      startDistanceFromShoreKm: looseNumber,
      endDistanceFromShoreKm: looseNumber,
      startDistanceFromPortKm: looseNumber,
      endDistanceFromPortKm: looseNumber,
    })
    .partial()
    .nullable()
    .optional(),
  vessel: eventVesselSchema,
  fishing: z
    .object({ totalDistanceKm: looseNumber, averageSpeedKnots: looseNumber })
    .partial()
    .nullable()
    .optional(),
  port_visit: z
    .object({
      visitId: nullableString,
      confidence: z.union([z.string(), z.number()]).nullable().optional(),
      durationHrs: looseNumber,
      startAnchorage: anchorageSchema.nullable().optional(),
      intermediateAnchorage: anchorageSchema.nullable().optional(),
      endAnchorage: anchorageSchema.nullable().optional(),
    })
    .nullable()
    .optional(),
  encounter: z
    .object({
      vessel: eventVesselSchema.nullable().optional(),
      medianDistanceKilometers: looseNumber,
      medianSpeedKnots: looseNumber,
      type: nullableString,
    })
    .nullable()
    .optional(),
  loitering: z
    .object({
      totalTimeHours: looseNumber,
      totalDistanceKm: looseNumber,
      averageSpeedKnots: looseNumber,
      averageDistanceFromShoreKm: looseNumber,
    })
    .partial()
    .nullable()
    .optional(),
});

export const eventsPageSchema = z.object({
  entries: z.array(z.unknown()),
  total: z.number().nullable().optional(),
  limit: z.number().nullable().optional(),
  offset: z.number().nullable().optional(),
  nextOffset: z.number().nullable().optional(),
  metadata: z
    .object({
      datasets: z.array(z.string()).optional(),
      dateRange: z.object({ from: z.string(), to: z.string() }).partial().optional(),
    })
    .partial()
    .passthrough()
    .optional(),
});

export type Anchorage = z.infer<typeof anchorageSchema>;
export type EventVessel = z.infer<typeof eventVesselSchema>;

export type NormalizedEvent = {
  id: string;
  /** Jenis dari provider: fishing | port_visit | encounter | loitering | lainnya (dipertahankan apa adanya). */
  type: string;
  start: string;
  end: string;
  /** Dihitung dari interval start–end; null bila interval tidak sah. */
  durationHours: number | null;
  /** Lokasi representatif kejadian, bukan posisi presisi kapal. */
  position: { lat: number; lon: number } | null;
  eezIds: string[];
  vessel: EventVessel;
  fishing: { totalDistanceKm: number | null; averageSpeedKnots: number | null } | null;
  portVisit: {
    visitId: string | null;
    confidence: string | null;
    providerDurationHours: number | null;
    startAnchorage: Anchorage | null;
    endAnchorage: Anchorage | null;
  } | null;
  encounter: {
    otherVessel: EventVessel | null;
    medianDistanceKm: number | null;
    medianSpeedKnots: number | null;
    encounterType: string | null;
  } | null;
  loitering: {
    totalTimeHours: number | null;
    totalDistanceKm: number | null;
    averageSpeedKnots: number | null;
    averageDistanceFromShoreKm: number | null;
  } | null;
};

export function intervalHours(start: string, end: string): number | null {
  const a = Date.parse(start);
  const b = Date.parse(end);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return (b - a) / 3_600_000;
}

export type EventParseResult = { events: NormalizedEvent[]; rejected: number };

/** Normalisasi entri events; entri yang tidak sesuai kontrak dihitung, bukan diam-diam dibuang. */
export function normalizeEvents(entries: unknown[]): EventParseResult {
  const events: NormalizedEvent[] = [];
  let rejected = 0;
  for (const entry of entries) {
    const parsed = rawEventSchema.safeParse(entry);
    if (!parsed.success) {
      rejected += 1;
      continue;
    }
    const e = parsed.data;
    const lat = e.position?.lat ?? null;
    const lon = e.position?.lon ?? null;
    events.push({
      id: e.id,
      type: e.type,
      start: e.start,
      end: e.end,
      durationHours: intervalHours(e.start, e.end),
      position: lat !== null && lon !== null ? { lat, lon } : null,
      eezIds: e.regions?.eez ?? [],
      vessel: e.vessel,
      fishing: e.fishing
        ? { totalDistanceKm: e.fishing.totalDistanceKm ?? null, averageSpeedKnots: e.fishing.averageSpeedKnots ?? null }
        : null,
      portVisit: e.port_visit
        ? {
            visitId: e.port_visit.visitId,
            confidence: e.port_visit.confidence === undefined || e.port_visit.confidence === null ? null : String(e.port_visit.confidence),
            providerDurationHours: e.port_visit.durationHrs,
            startAnchorage: e.port_visit.startAnchorage ?? null,
            endAnchorage: e.port_visit.endAnchorage ?? null,
          }
        : null,
      encounter: e.encounter
        ? {
            otherVessel: e.encounter.vessel ?? null,
            medianDistanceKm: e.encounter.medianDistanceKilometers,
            medianSpeedKnots: e.encounter.medianSpeedKnots,
            encounterType: e.encounter.type,
          }
        : null,
      loitering: e.loitering
        ? {
            totalTimeHours: e.loitering.totalTimeHours ?? null,
            totalDistanceKm: e.loitering.totalDistanceKm ?? null,
            averageSpeedKnots: e.loitering.averageSpeedKnots ?? null,
            averageDistanceFromShoreKm: e.loitering.averageDistanceFromShoreKm ?? null,
          }
        : null,
    });
  }
  return { events, rejected };
}

// ---------------------------------------------------------------------------
// Vessels
// ---------------------------------------------------------------------------

const selfReportedSchema = z.object({
  id: z.string(),
  ssvid: nullableString,
  shipname: nullableString,
  flag: nullableString,
  callsign: nullableString,
  imo: nullableString,
  sourceCode: z.array(z.string()).optional().transform((v) => v ?? []),
  transmissionDateFrom: nullableString,
  transmissionDateTo: nullableString,
});

const typedPeriodSchema = z.object({
  name: z.string(),
  source: nullableString,
  yearFrom: z.number().nullable().optional().transform((v) => v ?? null),
  yearTo: z.number().nullable().optional().transform((v) => v ?? null),
});

const combinedSourcesSchema = z.object({
  vesselId: z.string(),
  geartypes: z.array(typedPeriodSchema).optional().transform((v) => v ?? []),
  shiptypes: z.array(typedPeriodSchema).optional().transform((v) => v ?? []),
});

/**
 * Registry: kedua fixture kapal sampel kosong (registryInfoTotalRecords = 0), jadi field ini
 * mengikuti daftar di dokumentasi dan BELUM teruji dengan data nyata. Semua nullable.
 */
const registryInfoSchema = z.object({
  id: nullableString,
  ssvid: nullableString,
  shipname: nullableString,
  flag: nullableString,
  callsign: nullableString,
  imo: nullableString,
  lengthM: looseNumber,
  tonnageGt: looseNumber,
  transmissionDateFrom: nullableString,
  transmissionDateTo: nullableString,
});

const ownerSchema = z.object({
  name: nullableString,
  flag: nullableString,
  ssvid: nullableString,
  dateFrom: nullableString,
  dateTo: nullableString,
});

const array = <T extends z.ZodTypeAny>(schema: T) =>
  z
    .array(z.unknown())
    .optional()
    .transform((items) =>
      (items ?? []).flatMap((item) => {
        const r = schema.safeParse(item);
        return r.success ? [r.data as z.output<T>] : [];
      }),
    );

export const vesselIdentitySchema = z.object({
  dataset: nullableString,
  registryInfoTotalRecords: z.number().nullable().optional().transform((v) => v ?? null),
  registryInfo: array(registryInfoSchema),
  registryOwners: array(ownerSchema),
  combinedSourcesInfo: array(combinedSourcesSchema),
  selfReportedInfo: array(selfReportedSchema),
});
export type VesselIdentity = z.infer<typeof vesselIdentitySchema>;
export type SelfReportedIdentity = z.infer<typeof selfReportedSchema>;

export const vesselSearchSchema = z.object({
  entries: z.array(z.unknown()),
  total: z.number().nullable().optional(),
  limit: z.number().nullable().optional(),
  /** Token halaman berikut; null pada halaman terakhir (fixture: since=null). */
  since: z.string().nullable().optional(),
});

// ---------------------------------------------------------------------------
// 4Wings report (format=JSON)
// Bentuk nyata: { entries: [ { "<dataset:versi>": [ {date, flag, lat, lon, hours|detections, vesselIDs} ] } ] }
// ---------------------------------------------------------------------------

const reportRowSchema = z.object({
  /** Hari (DAILY), bulan, atau "start,end" (ENTIRE). */
  date: z.string(),
  flag: nullableString,
  /** Ada hanya bila spatial-aggregation=false (titik sel grid 0,1° pada resolusi LOW). */
  lat: looseNumber,
  lon: looseNumber,
  hours: looseNumber,
  detections: looseNumber,
  /** Jumlah ID kapal pada baris ini — BUKAN daftar ID; tidak dapat dijumlah menjadi jumlah unik. */
  vesselIDs: looseNumber,
  // Field berikut hanya muncul pada group-by=VESSEL_ID (fixture 12).
  vesselId: nullableString,
  shipName: nullableString,
  mmsi: nullableString,
  imo: nullableString,
  callsign: nullableString,
  geartype: nullableString,
  vesselType: nullableString,
  /** Jam aktivitas pertama/terakhir yang teramati dalam periode untuk kapal ini. */
  entryTimestamp: nullableString,
  exitTimestamp: nullableString,
});

export const reportSchema = z.object({
  entries: z.array(z.record(z.string(), z.array(z.unknown()))),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ReportMetric = "hours" | "detections";

export type ReportVessel = {
  vesselId: string;
  shipName: string | null;
  mmsi: string | null;
  imo: string | null;
  callsign: string | null;
  geartype: string | null;
  vesselType: string | null;
  entryTimestamp: string | null;
  exitTimestamp: string | null;
};

export type ReportRow = {
  date: string;
  /** null = bendera tidak diketahui; dipertahankan sebagai kelompok terpisah. */
  flag: string | null;
  lat: number | null;
  lon: number | null;
  value: number | null;
  vesselIdCount: number | null;
  vessel: ReportVessel | null;
};

export type NormalizedReport = {
  datasetResolved: string | null;
  rows: ReportRow[];
  rejected: number;
  providerMetadata: Record<string, unknown>;
};

export function normalizeReport(json: unknown, metric: ReportMetric): NormalizedReport {
  const parsed = reportSchema.parse(json);
  const rows: ReportRow[] = [];
  let rejected = 0;
  let datasetResolved: string | null = null;
  for (const entry of parsed.entries) {
    for (const [dataset, items] of Object.entries(entry)) {
      datasetResolved ??= dataset;
      for (const item of items) {
        const r = reportRowSchema.safeParse(item);
        if (!r.success) {
          rejected += 1;
          continue;
        }
        const d = r.data;
        rows.push({
          date: d.date,
          flag: d.flag,
          lat: d.lat,
          lon: d.lon,
          value: d[metric],
          vesselIdCount: d.vesselIDs,
          vessel: d.vesselId
            ? {
                vesselId: d.vesselId,
                shipName: d.shipName,
                mmsi: d.mmsi,
                imo: d.imo,
                callsign: d.callsign,
                geartype: d.geartype,
                vesselType: d.vesselType,
                entryTimestamp: d.entryTimestamp,
                exitTimestamp: d.exitTimestamp,
              }
            : null,
        });
      }
    }
  }
  return { datasetResolved, rows, rejected, providerMetadata: parsed.metadata ?? {} };
}
