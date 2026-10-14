/**
 * Probe lanjutan: untuk kapal ber-registry TMT dari hasil pencarian, ambil detail /v3/vessels/{id}
 * (registries-info-data=ALL) dan laporkan isi extraFields.images.
 *   npx tsx scripts/probe-vessel-photos-detail.ts "QUERY" ...
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

type Reg = { sourceCode?: string[]; extraFields?: Array<{ registrySource?: string; images?: unknown[] }> };
type Entry = { registryInfo?: Reg[]; selfReportedInfo?: Array<{ id: string; shipname?: string; flag?: string }> };

async function main() {
  const http = await import("@/lib/gfw/http");
  const token = process.env.GFW_API_ACCESS_TOKEN!;
  const out: unknown[] = [];
  const ids: Array<{ id: string; name?: string; flag?: string }> = [];
  for (const q of process.argv.slice(2)) {
    const res = await http.gfwRequest({
      path: "/v3/vessels/search",
      query: [["query", q], ["datasets[0]", "public-global-vessel-identity:latest"], ["limit", 50]],
    });
    for (const e of (res.json as { entries: Entry[] }).entries) {
      const tmt = (e.registryInfo ?? []).some((r) => (r.extraFields ?? []).some((x) => x.registrySource === "TMT"));
      const s = e.selfReportedInfo?.[0];
      if (tmt && s) ids.push({ id: s.id, name: s.shipname, flag: s.flag });
    }
  }
  console.log(`kapal TMT dari pencarian: ${ids.length}`);
  for (const v of ids.slice(0, 8)) {
    const res = await http.gfwRequest({
      path: `/v3/vessels/${encodeURIComponent(v.id)}`,
      query: [["dataset", "public-global-vessel-identity:latest"], ["registries-info-data", "ALL"]],
    });
    const body = res.json as Entry;
    const extras = (body.registryInfo ?? []).flatMap((r) => r.extraFields ?? []);
    const images = extras.flatMap((x) => x.images ?? []);
    console.log(`- ${v.name} (${v.flag}): extraFields=${extras.length}, images=${images.length}${images.length ? " → " + JSON.stringify(images).slice(0, 500) : ""}`);
    out.push({ vessel: v, extraFields: extras });
  }
  const text = JSON.stringify({ capturedAt: new Date().toISOString(), results: out }, null, 2);
  if (text.includes(token)) throw new Error("fixture memuat token");
  writeFileSync(path.join(process.cwd(), "fixtures", "gfw", "31-vessel-photo-detail.json"), text + "\n");
}

main().catch((e) => {
  console.error("GAGAL:", e?.code ?? "", e?.status ?? "", e?.message ?? e);
  process.exit(1);
});
