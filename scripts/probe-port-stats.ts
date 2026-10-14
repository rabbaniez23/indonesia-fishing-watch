/**
 * Contract check Tahap 7 (±8 request): cara agregasi kunjungan pelabuhan per pelabuhan tanpa mengunduh puluhan ribu event.
 *  22. POST events/stats port visits (ZEE Indonesia, 7 hari) — numEvents, numVessels, timeseries
 *  23. groupBy kandidat (PORT / NEXT_PORT_ID / FLAG) — catat groups atau pesan 422 (nilai yang diizinkan)
 *  24. timeFilterMode kandidat — catat pesan 422 bila nilai tidak dikenal
 *  25. events list dengan limit besar (1000) — apakah diterima, berapa entri
 *   npx tsx scripts/probe-port-stats.ts
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

async function main() {
  const http = await import("@/lib/gfw/http");
  const token = process.env.GFW_API_ACCESS_TOKEN!;
  const save = (name: string, data: unknown) => {
    const text = JSON.stringify(data, null, 2);
    if (text.includes(token)) throw new Error("fixture memuat token");
    writeFileSync(path.join(process.cwd(), "fixtures", "gfw", `${name}.json`), text + "\n");
  };
  const trim = (json: unknown) => {
    const b = JSON.parse(JSON.stringify(json ?? null));
    if (b?.metadata?.geometry) b.metadata.geometry = { _omitted: true };
    for (const k of ["groups", "timeseries", "entries"]) if (Array.isArray(b?.[k]) && b[k].length > 15) b[k] = { _arrayLength: b[k].length, sample: b[k].slice(0, 15) };
    return b;
  };
  const base = {
    datasets: ["public-global-port-visits-events:latest"],
    "start-date": "2026-09-26",
    "end-date": "2026-10-03",
    region: { dataset: "public-eez-areas", id: 8492 },
    timeseriesInterval: "DAY",
  };
  async function tryCall(name: string, req: import("@/lib/gfw/http").GfwRequest) {
    try {
      const res = await http.gfwRequest({ ...req, maxRetries: 0 });
      save(name, { capturedAt: new Date().toISOString(), request: { path: req.path, query: req.query ?? [], body: req.body ?? null }, response: { status: res.status, body: trim(res.json) } });
      return { ok: true as const, json: res.json as Record<string, unknown> };
    } catch (e) {
      const err = e as InstanceType<typeof http.GfwError>;
      save(name, { capturedAt: new Date().toISOString(), request: { path: req.path, query: req.query ?? [], body: req.body ?? null }, error: { code: err.code, status: err.status, detail: err.detail } });
      return { ok: false as const, error: `${err.code} ${err.status}: ${err.detail ?? ""}` };
    }
  }

  // 22. stats dasar (coba path /v3 lalu /api/v3)
  let statsPath = "/v3/events/stats";
  let r = await tryCall("22-port-stats", { method: "POST", path: statsPath, body: { ...base, includes: ["TOTAL_COUNT", "TIME_SERIES"] } });
  if (!r.ok && /NOT_FOUND/.test(r.error)) {
    statsPath = "/api/v3/events/stats";
    r = await tryCall("22-port-stats-apipath", { method: "POST", path: statsPath, body: { ...base, includes: ["TOTAL_COUNT", "TIME_SERIES"] } });
  }
  console.log(`22 stats ${statsPath}:`, r.ok ? JSON.stringify({ numEvents: r.json.numEvents, numVessels: r.json.numVessels, numFlags: r.json.numFlags, timeseries: Array.isArray(r.json.timeseries) ? r.json.timeseries.length : r.json.timeseries, keys: Object.keys(r.json) }) : r.error);

  // 23. groupBy kandidat
  for (const groupBy of ["PORT", "NEXT_PORT_ID", "FLAG"]) {
    const g = await tryCall(`23-port-stats-groupby-${groupBy.toLowerCase()}`, { method: "POST", path: statsPath, body: { ...base, groupBy, includes: ["TOTAL_COUNT", "EVENTS_GROUPED"] } });
    const groups = g.ok && Array.isArray(g.json.groups) ? (g.json.groups as unknown[]) : null;
    console.log(`23 groupBy=${groupBy}:`, g.ok ? `groups=${groups ? groups.length : "-"} contoh=${JSON.stringify(groups?.slice(0, 3) ?? null)}` : g.error);
  }

  // 24. timeFilterMode kandidat (nilai tidak dikenal → pesan 422 berguna)
  const t = await tryCall("24-events-timefiltermode", {
    method: "POST",
    path: "/v3/events",
    query: [["offset", 0], ["limit", 1]],
    body: { datasets: base.datasets, startDate: base["start-date"], endDate: base["end-date"], region: base.region, timeFilterMode: "__CEK__" },
  });
  console.log("24 timeFilterMode tidak dikenal:", t.ok ? "diterima (tidak divalidasi)" : t.error);

  // 25. limit besar
  const big = await tryCall("25-events-limit-1000", {
    method: "POST",
    path: "/v3/events",
    query: [["offset", 0], ["limit", 1000]],
    body: { datasets: base.datasets, startDate: base["start-date"], endDate: base["end-date"], region: base.region },
  });
  console.log("25 limit=1000:", big.ok ? `entries=${(big.json.entries as unknown[]).length} total=${big.json.total} nextOffset=${big.json.nextOffset}` : big.error);
  console.log("budget:", JSON.stringify(http.budgetToday()));
}

void main();
