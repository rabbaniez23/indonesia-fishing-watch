/**
 * Contract check Tahap 6 (±6 request):
 *  16. Events fishing dengan filter body `vessels: [id]` (ZEE Indonesia, 90 hari) — semua entri milik kapal itu?
 *  17. Halaman berikutnya (offset) — tanpa duplikat; perilaku nextOffset di halaman terakhir.
 *  18. Events port_visit untuk kapal yang sama.
 *  19. Pencarian nama ("NAILA") — kandidat, total, token `since`.
 *  20. Pencarian halaman berikut dengan `since` (bila ada).
 *   npx tsx scripts/probe-vessel-events.ts
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();
const VESSEL_ID = "11934d1ee-edef-e207-c667-11ce3ae21cfa"; // TB NAILA (fixture 02/06)

async function main() {
  const http = await import("@/lib/gfw/http");
  const token = process.env.GFW_API_ACCESS_TOKEN!;
  const save = (name: string, data: unknown) => {
    const text = JSON.stringify(data, null, 2);
    if (text.includes(token)) throw new Error("fixture memuat token");
    writeFileSync(path.join(process.cwd(), "fixtures", "gfw", `${name}.json`), text + "\n");
  };
  const stripGeometry = (json: unknown) => {
    const body = JSON.parse(JSON.stringify(json)) as { metadata?: { geometry?: unknown } };
    if (body.metadata?.geometry) body.metadata.geometry = { _omitted: "lihat region-eez-8492.geojson" };
    return body;
  };
  const events = async (name: string, dataset: string, offset: number, limit: number) => {
    const body = {
      datasets: [dataset],
      startDate: "2026-07-05",
      endDate: "2026-10-03",
      region: { dataset: "public-eez-areas", id: 8492 },
      vessels: [VESSEL_ID],
    };
    const res = await http.gfwRequest({ method: "POST", path: "/v3/events", query: [["offset", offset], ["limit", limit]], body });
    const json = res.json as { entries: Array<{ id: string; type: string; vessel: { id: string } }>; total: number; nextOffset: number | null; offset: number; limit: number };
    save(name, { capturedAt: new Date().toISOString(), request: { path: "/v3/events", query: [["offset", offset], ["limit", limit]], body }, response: { status: res.status, body: stripGeometry(json) } });
    return json;
  };

  const p1 = await events("16-events-vessel-filter-p1", "public-global-fishing-events:latest", 0, 2);
  const ids1 = p1.entries.map((e) => e.id);
  console.log(`16 fishing p1: total=${p1.total} entries=${p1.entries.length} nextOffset=${p1.nextOffset} semua milik kapal=${p1.entries.every((e) => e.vessel.id === VESSEL_ID)}`);

  if (p1.nextOffset !== null && p1.nextOffset !== undefined) {
    const p2 = await events("17-events-vessel-filter-p2", "public-global-fishing-events:latest", p1.nextOffset, 2);
    const dup = p2.entries.filter((e) => ids1.includes(e.id)).length;
    console.log(`17 fishing p2: entries=${p2.entries.length} duplikat=${dup} nextOffset=${p2.nextOffset} semua milik kapal=${p2.entries.every((e) => e.vessel.id === VESSEL_ID)}`);
    // Halaman terakhir: lompat ke offset >= total-1
    const lastOffset = Math.max(0, p1.total - 1);
    const pl = await events("17b-events-vessel-filter-last", "public-global-fishing-events:latest", lastOffset, 2);
    console.log(`17b fishing halaman terakhir (offset ${lastOffset}): entries=${pl.entries.length} nextOffset=${JSON.stringify(pl.nextOffset)}`);
  }

  const pv = await events("18-events-vessel-port-visits", "public-global-port-visits-events:latest", 0, 3);
  console.log(`18 port visits: total=${pv.total} entries=${pv.entries.length} semua milik kapal=${pv.entries.every((e) => e.vessel.id === VESSEL_ID)}`);

  const search = await http.gfwRequest({ path: "/v3/vessels/search", query: [["query", "NAILA"], ["datasets[0]", "public-global-vessel-identity:latest"], ["limit", 3]] });
  const s = search.json as { entries: unknown[]; total: number; since: string | null; limit: number };
  save("19-vessel-search-name", { capturedAt: new Date().toISOString(), request: { query: "NAILA", limit: 3 }, response: { status: search.status, headers: search.headers, body: { ...s, entries: s.entries.slice(0, 3) } } });
  console.log(`19 search "NAILA": total=${s.total} entries=${s.entries.length} since=${s.since ? "ada" : String(s.since)}`);
  if (s.since) {
    const next = await http.gfwRequest({ path: "/v3/vessels/search", query: [["query", "NAILA"], ["datasets[0]", "public-global-vessel-identity:latest"], ["limit", 3], ["since", s.since]] });
    const n = next.json as { entries: Array<{ selfReportedInfo: Array<{ id: string }> }>; since: string | null };
    const firstIds = (s.entries as Array<{ selfReportedInfo: Array<{ id: string }> }>).flatMap((e) => e.selfReportedInfo.map((x) => x.id));
    const dup = n.entries.flatMap((e) => e.selfReportedInfo.map((x) => x.id)).filter((id) => firstIds.includes(id)).length;
    save("20-vessel-search-name-p2", { capturedAt: new Date().toISOString(), request: { query: "NAILA", limit: 3, since: "(token dari halaman 1)" }, response: { status: next.status, body: { ...n, since: n.since ? "(token)" : n.since } } });
    console.log(`20 search halaman 2: entries=${n.entries.length} duplikat=${dup} since=${n.since ? "ada" : String(n.since)}`);
  }
  console.log("budget:", JSON.stringify(http.budgetToday()));
}

void main();
