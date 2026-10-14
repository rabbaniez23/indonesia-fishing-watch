import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  eezRegionListSchema,
  eventsPageSchema,
  intervalHours,
  normalizeEvents,
  normalizeReport,
  vesselIdentitySchema,
  vesselSearchSchema,
} from "./schemas";

/** Fixture nyata dari `npm run contract-check` (diringkas: array panjang → {_arrayLength, sample}). */
function fixture(name: string): { response: { body: Record<string, unknown> } } {
  return JSON.parse(readFileSync(path.join(process.cwd(), "fixtures", "gfw", `${name}.json`), "utf8"));
}
function sampled(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return (value as { sample: unknown[] }).sample;
}

describe("regions", () => {
  it("entri ZEE Indonesia dari respons nyata valid", () => {
    const body = fixture("01-eez-regions").response.body as { entriesMentioningIDN: unknown[] };
    const regions = eezRegionListSchema.parse(body.entriesMentioningIDN);
    expect(regions.find((r) => r.iso3 === "IDN")).toMatchObject({ id: 8492, label: "Indonesian Exclusive Economic Zone" });
  });
});

describe("events", () => {
  it("fishing: normalisasi kapal, posisi representatif, durasi dari interval", () => {
    const body = fixture("02-events-fishing").response.body;
    const page = eventsPageSchema.parse({ ...body, entries: sampled(body.entries) });
    expect(page.total).toBe(1548);
    expect(page.metadata?.datasets).toEqual(["public-global-fishing-events:v4.0"]);
    const { events, rejected } = normalizeEvents(page.entries);
    expect(rejected).toBe(0);
    const first = events[0];
    expect(first.type).toBe("fishing");
    expect(first.vessel).toMatchObject({ name: "TB NAILA", ssvid: "525400107", flag: "IDN" });
    expect(first.eezIds).toContain("8492");
    expect(first.durationHours).toBeCloseTo(intervalHours(first.start, first.end)!, 6);
    expect(first.position).toEqual({ lat: -2.4801, lon: 105.4275 });
  });

  it("port visit: anchorage, jarak string → angka, nama kapal null tetap null", () => {
    const body = fixture("03-events-port-visits").response.body;
    const { events } = normalizeEvents(sampled(body.entries));
    const visit = events[0];
    expect(visit.type).toBe("port_visit");
    expect(visit.vessel.name).toBeNull();
    expect(visit.portVisit?.startAnchorage).toMatchObject({ id: "idn-tarakan", name: "TARAKAN", distanceFromShoreKm: 2 });
    // Kejadian yang overlap periode bisa dimulai jauh sebelumnya (fixture: mulai 2012).
    expect(visit.start.startsWith("2012")).toBe(true);
  });

  it("encounter & loitering memiliki detail khusus jenisnya", () => {
    const enc = normalizeEvents(sampled(fixture("04-events-encounters").response.body.entries)).events[0];
    expect(enc.encounter?.otherVessel?.name).toBe("SURYA JAYA SAMPURNA");
    expect(enc.encounter?.encounterType).toBe("fishing-fishing");
    const loi = normalizeEvents(sampled(fixture("05-events-loitering").response.body.entries)).events[0];
    expect(loi.loitering?.totalTimeHours).toBeGreaterThan(0);
  });

  it("entri rusak dihitung sebagai rejected, tidak menghentikan halaman", () => {
    const { events, rejected } = normalizeEvents([{ id: "x" }, null]);
    expect(events).toHaveLength(0);
    expect(rejected).toBe(2);
  });

  it("interval terbalik menghasilkan durasi null", () => {
    expect(intervalHours("2026-10-02T00:00:00Z", "2026-10-01T00:00:00Z")).toBeNull();
  });
});

describe("vessels", () => {
  it("profil: identitas self-reported, registry kosong tetap kosong (tidak dikarang)", () => {
    const identity = vesselIdentitySchema.parse(fixture("06-vessel-by-id").response.body);
    expect(identity.dataset).toBe("public-global-vessel-identity:v4.0");
    expect(identity.registryInfo).toEqual([]);
    expect(identity.registryInfoTotalRecords).toBe(0);
    expect(identity.selfReportedInfo[0]).toMatchObject({ ssvid: "525400107", shipname: "TB NAILA", imo: null });
    expect(identity.combinedSourcesInfo[0].shiptypes[0].name).toBe("FISHING");
  });

  it("search: dua kandidat terpisah untuk MMSI sama (tidak digabung)", () => {
    const body = fixture("07-vessel-search").response.body;
    const page = vesselSearchSchema.parse({ ...body, entries: sampled(body.entries) });
    expect(page.total).toBe(2);
    expect(page.since).toBeNull();
    const identities = page.entries.map((e) => vesselIdentitySchema.parse(e));
    expect(identities).toHaveLength(2);
    expect(identities[0].selfReportedInfo.length).toBeGreaterThan(1);
  });
});

describe("4Wings report", () => {
  function reportBody(name: string) {
    const body = fixture(name).response.body as { entries: Array<Record<string, unknown>>; metadata: unknown };
    const entries = sampled(body.entries).map((entry) =>
      Object.fromEntries(Object.entries(entry as Record<string, unknown>).map(([k, v]) => [k, sampled(v)])),
    );
    return { ...body, entries };
  }

  it("fishing effort: dataset versi dari key entri, metric jam", () => {
    const report = normalizeReport(reportBody("08-report-fishing-effort"), "hours");
    expect(report.datasetResolved).toBe("public-global-fishing-effort:v4.0");
    expect(report.rejected).toBe(0);
    expect(report.rows[0]).toMatchObject({ flag: "IDN", lat: -5.9, lon: 110.9, value: 0.35, vesselIdCount: 1 });
    expect(report.providerMetadata).toEqual({});
  });

  it("SAR: metric deteksi; bendera kosong menjadi null (kelompok tidak diketahui)", () => {
    const report = normalizeReport(reportBody("10-report-sar"), "detections");
    expect(report.datasetResolved).toBe("public-global-sar-presence:v4.0");
    expect(report.rows.every((r) => typeof r.value === "number")).toBe(true);
    expect(report.rows.some((r) => r.flag === null)).toBe(true);
  });
});
