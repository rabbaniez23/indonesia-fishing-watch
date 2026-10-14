/**
 * Probe empiris: apakah lat/lon sel report 4Wings (LOW) = sudut barat daya, titik tengah, atau sudut timur laut?
 * Dokumentasi tidak menjelaskan. Dua report kecil dengan poligon kustom (POST geojson) yang hasil labelnya
 * berbeda untuk tiap hipotesis. Fixture: 14-grid-probe-A.json, 15-grid-probe-B.json.
 *   npx tsx scripts/probe-grid-alignment.ts
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

type Box = { name: string; lon: [number, number]; lat: [number, number]; expect: Record<string, [number, number]> };

const BOXES: Box[] = [
  {
    name: "14-grid-probe-A",
    lon: [112.76, 112.79],
    lat: [-7.19, -7.16],
    expect: { "sudut-barat-daya": [-7.2, 112.7], "titik-tengah": [-7.2, 112.8], "sudut-timur-laut": [-7.1, 112.8] },
  },
  {
    name: "15-grid-probe-B",
    lon: [112.71, 112.74],
    lat: [-7.24, -7.21],
    expect: { "sudut-barat-daya": [-7.3, 112.7], "titik-tengah": [-7.2, 112.7], "sudut-timur-laut": [-7.2, 112.8] },
  },
];

function polygon(box: Box) {
  const [w, e] = box.lon;
  const [s, n] = box.lat;
  return {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] } },
    ],
  };
}

async function main() {
  const http = await import("@/lib/gfw/http");
  const token = process.env.GFW_API_ACCESS_TOKEN!;
  const query: Array<[string, string]> = [
    ["datasets[0]", "public-global-presence:latest"],
    ["format", "JSON"],
    ["group-by", "FLAG"],
    ["temporal-resolution", "ENTIRE"],
    ["spatial-resolution", "LOW"],
    ["spatial-aggregation", "false"],
    ["date-range", "2026-09-26,2026-10-03"],
  ];
  const verdicts: string[] = [];
  for (const box of BOXES) {
    let body: unknown = { geojson: polygon(box) };
    let res;
    try {
      res = await http.gfwRequest({ method: "POST", path: "/v3/4wings/report", query, body, timeoutMs: 120_000, maxRetries: 0 });
    } catch (error) {
      const e = error as InstanceType<typeof http.GfwError>;
      console.log(`${box.name}: objek geojson ditolak (${e.code} ${e.status}: ${e.detail ?? ""}); mencoba geojson sebagai string`);
      body = { geojson: JSON.stringify(polygon(box)) };
      res = await http.gfwRequest({ method: "POST", path: "/v3/4wings/report", query, body, timeoutMs: 120_000, maxRetries: 0 });
    }
    const entries = (res.json as { entries: Array<Record<string, Array<{ lat: number; lon: number; hours: number }>>> }).entries;
    const rows = Object.values(entries[0] ?? {})[0] ?? [];
    const cells = [...new Set(rows.map((r) => `${r.lat},${r.lon}`))];
    const matches = Object.entries(box.expect)
      .filter(([, [lat, lon]]) => cells.length === 1 && cells[0] === `${lat},${lon}`)
      .map(([k]) => k);
    const text = JSON.stringify({ capturedAt: new Date().toISOString(), request: { method: "POST", path: "/v3/4wings/report", query, body }, response: { status: res.status, headers: res.headers, body: res.json }, cells, expect: box.expect, matches }, null, 2);
    if (text.includes(token)) throw new Error("fixture memuat token");
    writeFileSync(path.join(process.cwd(), "fixtures", "gfw", `${box.name}.json`), text + "\n");
    console.log(`${box.name}: sel dikembalikan = ${JSON.stringify(cells)} (${rows.length} baris) → cocok dengan: ${matches.join(", ") || "(tidak ada)"}`);
    verdicts.push(...matches);
  }
  const counts = verdicts.reduce<Record<string, number>>((acc, v) => ((acc[v] = (acc[v] ?? 0) + 1), acc), {});
  console.log("Kesimpulan:", JSON.stringify(counts), "| budget:", JSON.stringify(http.budgetToday()));
}

void main();
