import type { NormalizedEvent } from "@/lib/gfw/schemas";

/**
 * Agregasi kunjungan pelabuhan per pelabuhan GFW (FR-08). Pure, dapat diuji.
 * - Kunci = ID pelabuhan GFW dari startAnchorage.id (mis. "idn-tarakan") — bukan kode resmi nasional.
 * - Kunjungan dihitung per ID kejadian unik (dedup lintas halaman); kapal per GFW vessel ID unik.
 * - Nama = nama yang paling sering muncul (beberapa entri anchorage tidak bernama — fixture 29).
 * - Tidak menghasilkan koordinat pelabuhan dari rata-rata posisi.
 */

export const UNKNOWN_PORT = "__tanpa_id__";

export type PortSummary = {
  portId: string | null;
  name: string | null;
  /** Bendera/negara pelabuhan menurut anchorage GFW. */
  flag: string | null;
  visits: number;
  vessels: number;
  anchorages: number;
  medianDurationHours: number | null;
  firstStart: string | null;
  lastStart: string | null;
  confidence: { "2": number; "3": number; "4": number; other: number };
  atDockShare: number | null;
  topVesselFlags: Array<[string | null, number]>;
};

export type PortVisitsPayload = {
  kind: "port_visits";
  totalVisits: number;
  totalVessels: number;
  portCount: number;
  ports: PortSummary[];
  visitsWithoutPort: number;
};

type Acc = {
  names: Map<string, number>;
  flags: Map<string, number>;
  vessels: Set<string>;
  vesselFlags: Map<string | null, Set<string>>;
  anchorages: Set<string>;
  durations: number[];
  firstStart: string | null;
  lastStart: string | null;
  confidence: PortSummary["confidence"];
  atDockKnown: number;
  atDockYes: number;
  visits: number;
};

function bump<K>(map: Map<K, number>, key: K) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function mostFrequent(map: Map<string, number>): string | null {
  let best: string | null = null;
  let n = 0;
  for (const [k, v] of map) if (v > n) [best, n] = [k, v];
  return best;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export class PortAggregator {
  private ports = new Map<string, Acc>();
  private seen = new Set<string>();
  private allVessels = new Set<string>();
  private withoutPort = 0;
  duplicates = 0;
  nonPortVisits = 0;

  add(events: NormalizedEvent[]) {
    for (const e of events) {
      if (e.type !== "port_visit" || !e.portVisit) {
        this.nonPortVisits += 1;
        continue;
      }
      if (this.seen.has(e.id)) {
        this.duplicates += 1;
        continue;
      }
      this.seen.add(e.id);
      this.allVessels.add(e.vessel.id);
      const a = e.portVisit.startAnchorage;
      const key = a?.id ?? UNKNOWN_PORT;
      if (!a?.id) this.withoutPort += 1;
      let acc = this.ports.get(key);
      if (!acc) {
        acc = {
          names: new Map(),
          flags: new Map(),
          vessels: new Set(),
          vesselFlags: new Map(),
          anchorages: new Set(),
          durations: [],
          firstStart: null,
          lastStart: null,
          confidence: { "2": 0, "3": 0, "4": 0, other: 0 },
          atDockKnown: 0,
          atDockYes: 0,
          visits: 0,
        };
        this.ports.set(key, acc);
      }
      acc.visits += 1;
      if (a?.name) bump(acc.names, a.name);
      if (a?.flag) bump(acc.flags, a.flag);
      if (a?.anchorageId) acc.anchorages.add(a.anchorageId);
      acc.vessels.add(e.vessel.id);
      const vf = e.vessel.flag;
      if (!acc.vesselFlags.has(vf)) acc.vesselFlags.set(vf, new Set());
      acc.vesselFlags.get(vf)!.add(e.vessel.id);
      if (e.durationHours !== null) acc.durations.push(e.durationHours);
      if (!acc.firstStart || e.start < acc.firstStart) acc.firstStart = e.start;
      if (!acc.lastStart || e.start > acc.lastStart) acc.lastStart = e.start;
      const c = e.portVisit.confidence;
      if (c === "2" || c === "3" || c === "4") acc.confidence[c] += 1;
      else acc.confidence.other += 1;
      if (a?.atDock !== null && a?.atDock !== undefined) {
        acc.atDockKnown += 1;
        if (a.atDock) acc.atDockYes += 1;
      }
    }
  }

  result(): PortVisitsPayload {
    const ports: PortSummary[] = [...this.ports.entries()].map(([key, acc]) => ({
      portId: key === UNKNOWN_PORT ? null : key,
      name: mostFrequent(acc.names),
      flag: mostFrequent(acc.flags),
      visits: acc.visits,
      vessels: acc.vessels.size,
      anchorages: acc.anchorages.size,
      medianDurationHours: median(acc.durations),
      firstStart: acc.firstStart,
      lastStart: acc.lastStart,
      confidence: acc.confidence,
      atDockShare: acc.atDockKnown > 0 ? acc.atDockYes / acc.atDockKnown : null,
      topVesselFlags: [...acc.vesselFlags.entries()]
        .map(([flag, set]) => [flag, set.size] as [string | null, number])
        .sort((x, y) => y[1] - x[1])
        .slice(0, 3),
    }));
    ports.sort((x, y) => y.visits - x.visits);
    return {
      kind: "port_visits",
      totalVisits: this.seen.size,
      totalVessels: this.allVessels.size,
      portCount: ports.filter((p) => p.portId !== null).length,
      ports,
      visitsWithoutPort: this.withoutPort,
    };
  }
}
