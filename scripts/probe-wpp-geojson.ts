/**
 * Contract check WPP (poligon sendiri), ±3–6 request:
 *  32. POST /v3/4wings/report body {geojson} — bentuk mana yang diterima (objek FeatureCollection / string / Feature)?
 *  33. POST /v3/events body {geometry} — filter kejadian dengan poligon sendiri.
 *  34. POST /v3/events/stats body {geometry}.
 *   npx tsx scripts/probe-wpp-geojson.ts [kodeWpp=712]
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();
const CODE = process.argv[2] ?? "712";
const START = "2026-09-28";
const END = "2026-10-05";

async function main() {
  const http = await import("@/lib/gfw/http");
  const token = process.env.GFW_API_ACCESS_TOKEN!;
  const fc = JSON.parse(readFileSync(path.join("data", "wpp", `wpp-${CODE}.geojson`), "utf8"));
  const geometry = fc.features[0].geometry;
  const save = (name: string, data: unknown) => {
    const text = JSON.stringify(data, null, 2);
    if (text.includes(token)) throw new Error("fixture memuat token");
    writeFileSync(path.join("fixtures", "gfw", `${name}.json`), text + "\n");
  };
  const shrink = (json: unknown) => {
    const body = JSON.parse(JSON.stringify(json ?? null)) as { metadata?: { geometry?: unknown } } | null;
    if (body?.metadata?.geometry) body.metadata.geometry = { _omitted: "poligon WPP dikirim sendiri" };
    return body;
  };
  const try_ = async (label: string, fn: () => Promise<{ status: number; json: unknown; headers: Record<string, string | undefined> }>) => {
    try {
      const res = await fn();
      return { ok: true as const, label, status: res.status, json: res.json, xDatasets: res.headers["x-datasets"] };
    } catch (e) {
      const err = e as { code?: string; status?: number; message?: string; detail?: unknown };
      return { ok: false as const, label, status: err.status ?? null, code: err.code ?? null, message: err.message ?? String(e), detail: err.detail ?? null };
    }
  };

  // 32. Report fishing effort harian per bendera, satu poligon WPP.
  const query: Array<[string, string | number]> = [
    ["datasets[0]", "public-global-fishing-effort:latest"],
    ["format", "JSON"],
    ["group-by", "FLAG"],
    ["temporal-resolution", "DAILY"],
    ["spatial-aggregation", "true"],
    ["date-range", `${START},${END}`],
  ];
  const variants: Array<[string, unknown]> = [
    ["objek FeatureCollection", { geojson: fc }],
    ["string FeatureCollection", { geojson: JSON.stringify(fc) }],
    ["objek Feature", { geojson: fc.features[0] }],
  ];
  const reportAttempts = [];
  for (const [label, body] of variants) {
    const r = await try_(label, () => http.gfwRequest({ method: "POST", path: "/v3/4wings/report", query, body, timeoutMs: 120_000, maxRetries: 0 }));
    let total: number | null = null;
    if (r.ok) {
      const entries = (r.json as { entries?: Array<Record<string, Array<{ hours?: number }>>> }).entries ?? [];
      total = entries.flatMap((e) => Object.values(e).flat()).reduce((s, row) => s + (row.hours ?? 0), 0);
    }
    console.log(`report [${label}]: ${r.ok ? `OK ${r.status} · total ${total?.toFixed(1)} jam · x-datasets ${r.xDatasets}` : `GAGAL ${r.status} ${r.code} ${r.message}`}`);
    reportAttempts.push({ ...r, json: r.ok ? shrink(r.json) : undefined, totalHours: total });
    if (r.ok) break;
  }
  save("32-wpp-report-geojson", { capturedAt: new Date().toISOString(), wpp: CODE, request: { path: "/v3/4wings/report", query, body: "geojson WPP (lihat data/wpp)" }, attempts: reportAttempts });

  // 33. Events kunjungan pelabuhan dengan geometry.
  const evBody = { datasets: ["public-global-port-visits-events:latest"], startDate: START, endDate: END, geometry };
  const ev = await try_("events geometry", () => http.gfwRequest({ method: "POST", path: "/v3/events", query: [["offset", 0], ["limit", 5]], body: evBody }));
  const evJson = ev.ok ? (ev.json as { total?: number; entries?: Array<{ port_visit?: { startAnchorage?: { name?: string } } ; position?: { lat: number; lon: number } }> }) : null;
  console.log(`events [geometry]: ${ev.ok ? `OK · total ${evJson?.total} · contoh ${evJson?.entries?.slice(0, 3).map((e) => e.port_visit?.startAnchorage?.name).join(", ")}` : `GAGAL ${ev.status} ${ev.code} ${ev.message}`}`);
  save("33-wpp-events-geometry", { capturedAt: new Date().toISOString(), wpp: CODE, request: { ...evBody, geometry: "poligon WPP" }, result: ev.ok ? { status: ev.status, body: shrink(ev.json) } : ev });

  // 34. Stats dengan geometry.
  const stBody = { ...evBody, timeseriesInterval: "DAY", includes: ["TOTAL_COUNT"] };
  const st = await try_("stats geometry", () => http.gfwRequest({ method: "POST", path: "/v3/events/stats", body: stBody }));
  console.log(`events/stats [geometry]: ${st.ok ? `OK · ${JSON.stringify({ numEvents: (st.json as Record<string, unknown>).numEvents, numVessels: (st.json as Record<string, unknown>).numVessels })}` : `GAGAL ${st.status} ${st.code} ${st.message}`}`);
  save("34-wpp-events-stats-geometry", { capturedAt: new Date().toISOString(), wpp: CODE, request: { ...stBody, geometry: "poligon WPP" }, result: st.ok ? { status: st.status, body: st.json } : st });
}

main().catch((e) => {
  console.error("GAGAL:", e?.code ?? "", e?.status ?? "", e?.message ?? e);
  process.exit(1);
});
