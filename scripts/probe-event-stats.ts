/**
 * Contract check statistik kejadian (4 request): POST /v3/events/stats untuk fishing, port visit, encounter, loitering
 * di ZEE Indonesia selama 7 hari. Memastikan dataset encounter & loitering menerima body yang sama dengan port visit
 * (fixture 26–28) dan mencatat kunci respons apa saja yang benar-benar ada.
 *   npx tsx scripts/probe-event-stats.ts
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();
const START = "2026-09-28";
const END = "2026-10-05";

async function main() {
  const http = await import("@/lib/gfw/http");
  const { DATASETS } = await import("@/lib/gfw/capabilities");
  const { EVENT_KINDS } = await import("@/lib/gfw/adapters");
  const token = process.env.GFW_API_ACCESS_TOKEN!;
  const out: Record<string, unknown> = { capturedAt: new Date().toISOString(), start: START, end: END, region: "public-eez-areas/8492" };
  for (const kind of Object.keys(EVENT_KINDS) as Array<keyof typeof EVENT_KINDS>) {
    const body = {
      datasets: [DATASETS[EVENT_KINDS[kind]].alias],
      startDate: START,
      endDate: END,
      region: { dataset: "public-eez-areas", id: 8492 },
      timeseriesInterval: "DAY",
      includes: ["TOTAL_COUNT"],
    };
    try {
      const res = await http.gfwRequest({ method: "POST", path: "/v3/events/stats", body });
      const json = res.json as Record<string, unknown>;
      const summary = Object.fromEntries(
        Object.entries(json).map(([k, v]) => [k, Array.isArray(v) ? { _arrayLength: v.length, sample: v.slice(0, 3) } : v]),
      );
      out[kind] = { status: res.status, keys: Object.keys(json), body: summary };
      console.log(kind, res.status, Object.keys(json).join(","), json.numEvents, json.numVessels, json.numFlags);
    } catch (e) {
      out[kind] = { error: (e as Error).message };
      console.log(kind, "GAGAL", (e as Error).message);
    }
  }
  const text = JSON.stringify(out, null, 2);
  if (text.includes(token)) throw new Error("fixture memuat token");
  writeFileSync(path.join("fixtures", "gfw", "35-event-stats-all-kinds.json"), text + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
