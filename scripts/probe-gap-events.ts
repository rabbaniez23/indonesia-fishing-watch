/**
 * Contract check AIS gap / "AIS mati" (2–3 request): apakah token kita boleh membaca public-global-gaps-events,
 * dan field apa yang benar-benar ada. ZEE Indonesia, 7 hari.
 *   npx tsx scripts/probe-gap-events.ts
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();
const START = "2026-09-28";
const END = "2026-10-05";
const DATASET = "public-global-gaps-events:latest";
const REGION = { dataset: "public-eez-areas", id: 8492 };

async function main() {
  const http = await import("@/lib/gfw/http");
  const token = process.env.GFW_API_ACCESS_TOKEN!;
  const out: Record<string, unknown> = { capturedAt: new Date().toISOString(), start: START, end: END, dataset: DATASET, region: "public-eez-areas/8492" };
  const run = async (name: string, req: Parameters<typeof http.gfwRequest>[0]) => {
    try {
      const res = await http.gfwRequest(req);
      out[name] = { status: res.status, headers: { "x-datasets": res.headers["x-datasets"] ?? null }, body: res.json };
      console.log(name, res.status);
      return res.json as Record<string, unknown>;
    } catch (e) {
      const err = e as { code?: string; status?: number; message: string };
      out[name] = { error: err.code ?? "ERROR", status: err.status ?? null, message: err.message };
      console.log(name, "GAGAL", err.code, err.status, err.message);
      return null;
    }
  };
  const stats = await run("stats", {
    method: "POST",
    path: "/v3/events/stats",
    body: { datasets: [DATASET], startDate: START, endDate: END, region: REGION, timeseriesInterval: "DAY", includes: ["TOTAL_COUNT"] },
  });
  if (stats) console.log("  numEvents", stats.numEvents, "numVessels", stats.numVessels, "numFlags", stats.numFlags);
  const list = await run("events", {
    method: "POST",
    path: "/v3/events",
    query: [["offset", 0], ["limit", 3]],
    body: { datasets: [DATASET], startDate: START, endDate: END, region: REGION },
  });
  if (list) {
    const first = (list.entries as Array<Record<string, unknown>> | undefined)?.[0];
    console.log("  total", list.total, "keys", first ? Object.keys(first).join(",") : "-");
    if (first?.gap) console.log("  gap keys", Object.keys(first.gap as object).join(","));
  }
  const text = JSON.stringify(out, null, 2);
  if (text.includes(token)) throw new Error("fixture memuat token");
  writeFileSync(path.join("fixtures", "gfw", "36-gap-events-probe.json"), text + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
