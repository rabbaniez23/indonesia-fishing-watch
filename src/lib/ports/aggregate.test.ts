import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeEvents, type NormalizedEvent } from "@/lib/gfw/schemas";
import { PortAggregator } from "./aggregate";

const fixtureEvents = (name: string): NormalizedEvent[] => {
  const f = JSON.parse(readFileSync(path.join(process.cwd(), "fixtures", "gfw", `${name}.json`), "utf8"));
  const entries = Array.isArray(f.response.body.entries) ? f.response.body.entries : f.response.body.entries.sample;
  return normalizeEvents(entries).events;
};

describe("PortAggregator", () => {
  it("fixture nyata Tarakan (filter portIds): 1 pelabuhan, nama dari entri bernama, kunjungan = event unik", () => {
    const events = fixtureEvents("29-events-port-ids-filter");
    const agg = new PortAggregator();
    agg.add(events);
    const r = agg.result();
    expect(r.portCount).toBe(1);
    expect(r.ports[0]).toMatchObject({ portId: "idn-tarakan", name: "TARAKAN", visits: events.length });
    expect(r.totalVisits).toBe(events.length);
  });

  it("event yang sama di dua halaman dihitung sekali; kapal dihitung unik", () => {
    const events = fixtureEvents("18-events-vessel-port-visits");
    const agg = new PortAggregator();
    agg.add(events);
    agg.add(events);
    const r = agg.result();
    expect(agg.duplicates).toBe(events.length);
    expect(r.totalVisits).toBe(events.length);
    expect(r.totalVessels).toBe(1);
    expect(r.ports.map((p) => p.portId)).toEqual(expect.arrayContaining(["idn-tuban", "idn-banjarmasin"]));
  });

  it("durasi median dari interval; confidence & di-dermaga dihitung; kejadian non-port diabaikan", () => {
    const events = fixtureEvents("18-events-vessel-port-visits");
    const agg = new PortAggregator();
    agg.add([...events, ...fixtureEvents("02-events-fishing")]);
    const r = agg.result();
    const tuban = r.ports.find((p) => p.portId === "idn-tuban")!;
    expect(tuban.medianDurationHours).toBeGreaterThan(50);
    expect(tuban.confidence["4"]).toBe(1);
    expect(agg.nonPortVisits).toBeGreaterThan(0);
  });

  it("kunjungan tanpa ID pelabuhan dilaporkan terpisah", () => {
    const [e] = fixtureEvents("18-events-vessel-port-visits");
    const noPort = { ...e, id: "x1", portVisit: { ...e.portVisit!, startAnchorage: null } };
    const agg = new PortAggregator();
    agg.add([noPort]);
    const r = agg.result();
    expect(r.visitsWithoutPort).toBe(1);
    expect(r.portCount).toBe(0);
    expect(r.ports[0].portId).toBeNull();
  });
});
