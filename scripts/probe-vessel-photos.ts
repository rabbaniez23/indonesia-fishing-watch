/**
 * Probe: apakah Vessels API mengembalikan foto kapal (TMT) di registryInfo[].extraFields?
 * Menjalankan beberapa pencarian (±8 request) dan melaporkan struktur extraFields — tanpa mencetak token.
 *   npx tsx scripts/probe-vessel-photos.ts
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();
const QUERIES = process.argv.slice(2).length ? process.argv.slice(2) : ["LONG XING", "FU YUAN YU", "SHIN JI", "BAHARI", "MINA", "SAMUDERA"];

type Entry = { registryInfoTotalRecords?: number; registryInfo?: Array<Record<string, unknown>>; selfReportedInfo?: Array<{ id: string; shipname?: string; flag?: string }> };

async function main() {
  const http = await import("@/lib/gfw/http");
  const token = process.env.GFW_API_ACCESS_TOKEN!;
  const keys = new Map<string, number>();
  const samples: unknown[] = [];
  let entries = 0;
  let withRegistryTotal = 0;
  let withRegistryInfo = 0;
  let withExtra = 0;
  for (const q of QUERIES) {
    const res = await http.gfwRequest({
      path: "/v3/vessels/search",
      query: [
        ["query", q],
        ["datasets[0]", "public-global-vessel-identity:latest"],
        ["limit", 50],
        ["includes[0]", "MATCH_CRITERIA"],
        ["includes[1]", "OWNERSHIP"],
        ["includes[2]", "AUTHORIZATIONS"],
      ],
    });
    const body = res.json as { entries: Entry[]; total?: number };
    for (const e of body.entries) {
      entries++;
      if ((e.registryInfoTotalRecords ?? 0) > 0) withRegistryTotal++;
      if (e.registryInfo?.length) withRegistryInfo++;
      for (const r of e.registryInfo ?? []) {
        const extra = r.extraFields as unknown;
        if (extra && (Array.isArray(extra) ? extra.length : Object.keys(extra as object).length)) {
          withExtra++;
          const list = Array.isArray(extra) ? extra : [extra];
          for (const x of list) for (const k of Object.keys(x as object)) keys.set(k, (keys.get(k) ?? 0) + 1);
          const imgs = list.flatMap((x) => ((x as { images?: unknown[] }).images ?? []));
          if (imgs.length) console.log(`  FOTO: ${e.selfReportedInfo?.[0]?.shipname} (${e.selfReportedInfo?.[0]?.flag}) →`, JSON.stringify(imgs).slice(0, 600));
          if (samples.length < 5 || imgs.length) samples.push({ query: q, name: e.selfReportedInfo?.[0]?.shipname, flag: e.selfReportedInfo?.[0]?.flag, registryKeys: Object.keys(r), extraFields: extra });
        }
      }
    }
    console.log(`"${q}": ${body.entries.length} entri (total ${body.total ?? "?"})`);
  }
  console.log(`\nentri=${entries} · registryInfoTotalRecords>0: ${withRegistryTotal} · registryInfo berisi: ${withRegistryInfo} · extraFields berisi: ${withExtra}`);
  console.log("kunci extraFields:", Object.fromEntries(keys));
  const text = JSON.stringify({ capturedAt: new Date().toISOString(), queries: QUERIES, entries, withRegistryTotal, withRegistryInfo, withExtra, keys: Object.fromEntries(keys), samples }, null, 2);
  if (text.includes(token)) throw new Error("fixture memuat token");
  writeFileSync(path.join(process.cwd(), "fixtures", "gfw", `30-vessel-photo-probe${process.argv.length > 2 ? "-b" : ""}.json`), text + "\n");
  console.log("\ncontoh (maks 5):");
  console.log(JSON.stringify(samples, null, 2).slice(0, 4000));
}

main().catch((e) => {
  console.error("GAGAL:", e?.code ?? "", e?.status ?? "", e?.message ?? e);
  process.exit(1);
});
