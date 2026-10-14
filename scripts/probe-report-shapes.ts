/**
 * Probe bentuk report 4Wings yang belum teruji di contract check utama (3 request):
 *  11. fishing effort, temporal DAILY, spatial-aggregation=true, group-by FLAG  (tren harian)
 *  12. fishing effort, temporal ENTIRE, spatial-aggregation=true, group-by VESSEL_ID (kapal unik)
 *  13. GET /v3/4wings/last-report setelah report 12 selesai (bentuk & apakah sama dengan 12)
 *   npx tsx scripts/probe-report-shapes.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();
const DIR = path.join(process.cwd(), "fixtures", "gfw");

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const http = await import("@/lib/gfw/http");
  const token = process.env.GFW_API_ACCESS_TOKEN!;
  mkdirSync(DIR, { recursive: true });
  const today = new Date(`${isoDay(new Date())}T00:00:00Z`);
  const end = isoDay(new Date(today.getTime() - 10 * 86_400_000));
  const start = isoDay(new Date(today.getTime() - 17 * 86_400_000));

  function save(name: string, data: unknown) {
    const text = JSON.stringify(data, null, 2);
    if (text.includes(token)) throw new Error("fixture memuat token");
    writeFileSync(path.join(DIR, `${name}.json`), text + "\n");
  }

  function summarize(json: unknown) {
    const body = json as { entries?: Array<Record<string, unknown[]>>; metadata?: unknown; total?: unknown };
    const first = body?.entries?.[0];
    if (!first) return { body: json, stats: null };
    const [key, rows] = Object.entries(first)[0] ?? [];
    const list = Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
    const fields = new Set<string>();
    list.forEach((r) => Object.keys(r).forEach((k) => fields.add(k)));
    return {
      body: { ...body, entries: [{ [key]: { _arrayLength: list.length, sample: list.slice(0, 12) } }] },
      stats: {
        datasetKey: key,
        rows: list.length,
        fields: [...fields].sort(),
        rowsWithLatLon: list.filter((r) => typeof r.lat === "number").length,
        distinctVesselId: new Set(list.map((r) => r.vesselId).filter(Boolean)).size,
        distinctDates: [...new Set(list.map((r) => r.date))].slice(0, 10),
        sumHours: list.reduce((a, r) => a + (typeof r.hours === "number" ? r.hours : 0), 0),
      },
    };
  }

  const base: Array<[string, string | number]> = [
    ["datasets[0]", "public-global-fishing-effort:latest"],
    ["format", "JSON"],
    ["spatial-aggregation", "true"],
    ["date-range", `${start},${end}`],
    ["region-dataset", "public-eez-areas"],
    ["region-id", 8492],
  ];
  const probes: Array<[string, Array<[string, string | number]>]> = [
    ["11-report-fishing-daily-aggregated", [...base, ["group-by", "FLAG"], ["temporal-resolution", "DAILY"]]],
    ["12-report-fishing-vessels-aggregated", [...base, ["group-by", "VESSEL_ID"], ["temporal-resolution", "ENTIRE"]]],
  ];

  for (const [name, query] of probes) {
    try {
      const res = await http.gfwRequest({ path: "/v3/4wings/report", query, timeoutMs: 120_000, maxRetries: 0 });
      const { body, stats } = summarize(res.json);
      save(name, { capturedAt: new Date().toISOString(), request: { path: "/v3/4wings/report", query }, response: { status: res.status, headers: res.headers, body }, stats });
      console.log(`OK    ${name}`, JSON.stringify(stats));
    } catch (error) {
      const e = error as InstanceType<typeof http.GfwError>;
      save(name, { capturedAt: new Date().toISOString(), request: { query }, error: { code: e.code, status: e.status, detail: e.detail } });
      console.log(`GAGAL ${name} ${e.code} ${e.status} ${e.detail ?? ""}`);
    }
  }

  try {
    const res = await http.gfwRequest({ path: "/v3/4wings/last-report", maxRetries: 0 });
    const { body, stats } = summarize(res.json);
    const topKeys = res.json && typeof res.json === "object" ? Object.keys(res.json) : [];
    save("13-last-report", { capturedAt: new Date().toISOString(), request: { path: "/v3/4wings/last-report" }, response: { status: res.status, headers: res.headers, topKeys, body }, stats });
    console.log("OK    13-last-report", res.status, "keys:", topKeys.join(","), JSON.stringify(stats));
  } catch (error) {
    const e = error as InstanceType<typeof http.GfwError>;
    save("13-last-report", { capturedAt: new Date().toISOString(), error: { code: e.code, status: e.status, detail: e.detail } });
    console.log(`GAGAL 13-last-report ${e.code} ${e.status} ${e.detail ?? ""}`);
  }
  console.log("Budget:", JSON.stringify(http.budgetToday()));
}

void main();
