/**
 * Contract check GFW (PRD §16.1) dengan token nyata, hemat request (±12).
 * Menyimpan respons asli sebagai fixture di fixtures/gfw/ (tanpa token) dan
 * menulis status akses ke tabel `datasets`.
 *   npm run contract-check
 *
 * Skrip ini sengaja TIDAK mengasumsikan bentuk respons: ia mencatat apa yang benar-benar diterima.
 * Schema/normalizer aplikasi ditulis setelah fixture diperiksa.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

const FIXTURE_DIR = path.join(process.cwd(), "fixtures", "gfw");

type Step = { name: string; ok: boolean; summary: string };
const steps: Step[] = [];

function log(step: Step) {
  steps.push(step);
  console.log(`${step.ok ? "OK  " : "GAGAL"} ${step.name} — ${step.summary}`);
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Periode pendek: 7 hari UTC penuh, berakhir 10 hari sebelum hari ini (buffer keterlambatan data). */
function shortPeriod() {
  const today = new Date(`${isoDay(new Date())}T00:00:00Z`);
  const end = new Date(today.getTime() - 10 * 86_400_000);
  const start = new Date(end.getTime() - 7 * 86_400_000);
  return { start: isoDay(start), end: isoDay(end) };
}

async function main() {
  const http = await import("@/lib/gfw/http");
  const caps = await import("@/lib/gfw/capabilities");
  const { readZip } = await import("@/lib/gfw/zip");
  const { DATASETS } = caps;
  const token = process.env.GFW_API_ACCESS_TOKEN;
  if (!token) {
    console.error("GFW_API_ACCESS_TOKEN belum ada di .env.local.");
    process.exitCode = 1;
    return;
  }
  mkdirSync(FIXTURE_DIR, { recursive: true });
  caps.ensureDatasetRegistry();

  function saveFixture(name: string, data: unknown) {
    const text = JSON.stringify(data, null, 2);
    if (text.includes(token!)) throw new Error(`Fixture ${name} memuat token — dibatalkan.`);
    writeFileSync(path.join(FIXTURE_DIR, `${name}.json`), text + "\n");
  }

  function describeError(error: unknown) {
    if (error instanceof http.GfwError) {
      return { code: error.code, status: error.status, detail: error.detail, upstreamMetadata: error.upstreamMetadata };
    }
    return { code: "UNEXPECTED", status: null, detail: error instanceof Error ? error.message : String(error) };
  }

  async function call(name: string, req: import("@/lib/gfw/http").GfwRequest, trim?: (json: unknown) => unknown) {
    const request = { method: req.method ?? "GET", path: req.path, query: req.query ?? [], body: req.body ?? null };
    try {
      const res = await http.gfwRequest(req);
      let parsed: unknown = res.json;
      let zipFiles: Record<string, unknown> | null = null;
      if (res.bytes) {
        zipFiles = {};
        try {
          for (const [file, content] of readZip(res.bytes)) {
            const text = content.toString("utf8");
            let value: unknown = text.slice(0, 4000);
            if (file.endsWith(".json")) {
              try {
                value = JSON.parse(text);
              } catch {
                /* simpan teks */
              }
            }
            zipFiles[file] = value;
          }
        } catch (zipError) {
          zipFiles = { _error: String(zipError), _byteLength: res.bytes.byteLength };
        }
        parsed = zipFiles;
      }
      saveFixture(name, {
        capturedAt: new Date().toISOString(),
        request,
        response: { status: res.status, headers: res.headers, contentType: res.contentType, body: trim ? trim(parsed) : parsed },
      });
      return { ok: true as const, res, parsed };
    } catch (error) {
      const err = describeError(error);
      saveFixture(name, { capturedAt: new Date().toISOString(), request, error: err });
      return { ok: false as const, error: err };
    }
  }

  /** Pangkas array panjang agar fixture tetap kecil; total asli dicatat. */
  function trimEntries(json: unknown, keep = 5): unknown {
    if (Array.isArray(json)) return { _arrayLength: json.length, sample: json.slice(0, keep) };
    if (json && typeof json === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(json)) {
        out[k] = Array.isArray(v) && v.length > keep ? { _arrayLength: v.length, sample: v.slice(0, keep) } : v;
      }
      return out;
    }
    return json;
  }

  /** Events mengirim poligon wilayah lengkap di metadata.geometry; simpan terpisah, ringkas di fixture. */
  function compactEvents(json: unknown): unknown {
    if (!json || typeof json !== "object") return json;
    const body = { ...(json as Record<string, unknown>) };
    const metadata = body.metadata as Record<string, unknown> | undefined;
    if (metadata?.geometry) {
      const text = JSON.stringify(metadata.geometry);
      writeFileSync(path.join(FIXTURE_DIR, `region-eez-${eezId}.geojson`), text);
      body.metadata = {
        ...metadata,
        geometry: {
          _omitted: `lihat region-eez-${eezId}.geojson`,
          bytes: text.length,
          sha256: createHash("sha256").update(text).digest("hex"),
        },
      };
    }
    return trimEntries(body, 5);
  }

  /** Report: entries[0]["<dataset:versi>"] berisi baris sel; simpan 10 baris + statistik. */
  function compactReport(json: unknown): unknown {
    const body = json as { entries?: Array<Record<string, unknown[]>> } | null;
    const first = body?.entries?.[0];
    if (!first) return json;
    const [key, rows] = Object.entries(first)[0] ?? [];
    if (!Array.isArray(rows)) return json;
    return { ...body, entries: [{ [key]: { _arrayLength: rows.length, sample: rows.slice(0, 10) } }] };
  }

  const period = shortPeriod();
  console.log(`Periode uji: ${period.start} s.d. ${period.end} (end eksklusif, hari UTC)\n`);

  // 1. Daftar ZEE → cari ID ZEE Indonesia dari respons nyata.
  let eezId: number | null = null;
  {
    const r = await call(
      "01-eez-regions",
      { path: `/v3/datasets/${DATASETS.eezRegions.alias}/context-layers` },
      (json) => {
        if (!Array.isArray(json)) return trimEntries(json);
        const idn = json.filter((e) => e && typeof e === "object" && JSON.stringify(e).includes("IDN"));
        return { _arrayLength: json.length, entriesMentioningIDN: idn, sample: json.slice(0, 3) };
      },
    );
    if (r.ok && Array.isArray(r.parsed)) {
      const candidates = (r.parsed as Array<Record<string, unknown>>).filter((e) => e.iso3 === "IDN");
      console.log("   Kandidat ZEE dengan iso3=IDN:", JSON.stringify(candidates));
      if (candidates.length === 1 && typeof candidates[0].id === "number") eezId = candidates[0].id;
      log({
        name: "Regions: daftar ZEE",
        ok: candidates.length === 1,
        summary: `${r.parsed.length} wilayah; ${candidates.length} kandidat iso3=IDN${eezId !== null ? ` → id ${eezId}` : ""}`,
      });
      if (candidates.length === 1) caps.recordDatasetSuccess(DATASETS.eezRegions.alias, null);
      else caps.recordDatasetFailure(DATASETS.eezRegions.alias, "AMBIGUOUS_REGION", `Kandidat IDN: ${candidates.length}`);
    } else {
      log({ name: "Regions: daftar ZEE", ok: false, summary: JSON.stringify(r.ok ? "bukan array" : r.error) });
      if (!r.ok) caps.recordDatasetFailure(DATASETS.eezRegions.alias, r.error.code, r.error.detail);
    }
  }
  if (eezId === null) {
    console.log("\nID ZEE Indonesia tidak dapat dipastikan; langkah berbasis wilayah dilewati.");
  }

  // 2. Events per jenis (POST dengan region). Path dicoba sesuai dokumentasi; varian dicatat.
  let eventsPath: string | null = null;
  type SampleVessel = { id?: string; ssvid?: string; name?: string };
  let sampleVessel: SampleVessel | null = null as SampleVessel | null;
  const eventKinds = [
    ["02-events-fishing", DATASETS.fishingEvents.alias, 5],
    ["03-events-port-visits", DATASETS.portVisitEvents.alias, 5],
    ["04-events-encounters", DATASETS.encounterEvents.alias, 3],
    ["05-events-loitering", DATASETS.loiteringEvents.alias, 3],
  ] as const;
  if (eezId !== null) {
    for (const [fixture, alias, limit] of eventKinds) {
      const body = {
        datasets: [alias],
        startDate: period.start,
        endDate: period.end,
        region: { dataset: DATASETS.eezRegions.alias, id: eezId },
      };
      const query: Array<[string, number]> = [
        ["offset", 0],
        ["limit", limit],
      ];
      const candidates: string[] = eventsPath ? [eventsPath] : ["/v3/events", "/api/v3/events"];
      let result: Awaited<ReturnType<typeof call>> | null = null;
      for (const p of candidates) {
        result = await call(
          `${fixture}${p === "/api/v3/events" ? "-apipath" : ""}`,
          { method: "POST", path: p, query, body },
          compactEvents,
        );
        if (result.ok || result.error.code !== "NOT_FOUND") {
          if (result.ok) eventsPath = p;
          break;
        }
      }
      if (result && result.ok) {
        const json = result.parsed as Record<string, unknown>;
        const entries = Array.isArray(json?.entries) ? (json.entries as Array<Record<string, unknown>>) : [];
        // Events tidak mengirim header x-datasets; versi ada di metadata.datasets (terbukti di fixture).
        const metaDatasets = (json?.metadata as { datasets?: unknown } | undefined)?.datasets;
        const version =
          (Array.isArray(metaDatasets) ? (metaDatasets as string[]).find((d) => d.startsWith(alias.split(":")[0])) : undefined) ??
          caps.resolvedVersionFromHeader(result.res.headers["x-datasets"], alias);
        caps.recordDatasetSuccess(alias, version);
        if (!sampleVessel && entries[0]?.vessel && typeof entries[0].vessel === "object") {
          sampleVessel = entries[0].vessel as SampleVessel;
        }
        log({
          name: `Events: ${alias}`,
          ok: true,
          summary: `path ${eventsPath}; total=${String(json?.total)}; entries=${entries.length}; nextOffset=${String(json?.nextOffset)}; versi=${version ?? "-"}`,
        });
      } else if (result) {
        caps.recordDatasetFailure(alias, result.error.code, result.error.detail, result.error.code === "INVALID_REQUEST");
        log({ name: `Events: ${alias}`, ok: false, summary: `${result.error.code} ${result.error.status}: ${result.error.detail ?? ""}` });
      }
    }
  }

  // 3. Vessels: profil dari kapal sampel event + pencarian berdasarkan MMSI (ssvid).
  if (sampleVessel?.id) {
    const one = await call("06-vessel-by-id", {
      path: `/v3/vessels/${encodeURIComponent(sampleVessel.id)}`,
      query: [["dataset", DATASETS.vesselIdentity.alias]],
    });
    if (one.ok) caps.recordDatasetSuccess(DATASETS.vesselIdentity.alias, caps.resolvedVersionFromHeader(one.res.headers["x-datasets"], DATASETS.vesselIdentity.alias));
    log({
      name: "Vessels: profil by id",
      ok: one.ok,
      summary: one.ok ? `kunci top-level: ${Object.keys((one.parsed as object) ?? {}).join(", ")}` : `${one.error.code}: ${one.error.detail ?? ""}`,
    });
    if (!one.ok) caps.recordDatasetFailure(DATASETS.vesselIdentity.alias, one.error.code, one.error.detail);

    if (sampleVessel.ssvid) {
      const search = await call(
        "07-vessel-search",
        {
          path: "/v3/vessels/search",
          query: [
            ["query", sampleVessel.ssvid],
            ["datasets[0]", DATASETS.vesselIdentity.alias],
            ["limit", 5],
          ],
        },
        (json) => trimEntries(json, 3),
      );
      const json = search.ok ? (search.parsed as Record<string, unknown>) : null;
      log({
        name: "Vessels: search (MMSI kapal sampel)",
        ok: search.ok,
        summary: search.ok
          ? `total=${String(json?.total)}; entries=${Array.isArray(json?.entries) ? json.entries.length : "?"}; since=${json?.since ? "ada" : "tidak ada"}`
          : `${search.error.code}: ${search.error.detail ?? ""}`,
      });
    }
  } else {
    log({ name: "Vessels", ok: false, summary: "dilewati — tidak ada kapal sampel dari events" });
  }

  // 4. Report 4Wings per dataset (GET dengan region-id; satu report pada satu waktu).
  if (eezId !== null) {
    const reports = [
      ["08-report-fishing-effort", DATASETS.fishingEffort.alias],
      ["09-report-presence", DATASETS.presence.alias],
      ["10-report-sar", DATASETS.sar.alias],
    ] as const;
    for (const [fixture, alias] of reports) {
      const r = await call(
        fixture,
        {
          path: "/v3/4wings/report",
          timeoutMs: 120_000,
          maxRetries: 0,
          query: [
            ["datasets[0]", alias],
            ["format", "JSON"],
            ["group-by", "FLAG"],
            ["temporal-resolution", "ENTIRE"],
            ["spatial-resolution", "LOW"],
            ["spatial-aggregation", "false"],
            ["date-range", `${period.start},${period.end}`],
            ["region-dataset", DATASETS.eezRegions.alias],
            ["region-id", eezId],
          ],
        },
        compactReport,
      );
      if (r.ok) {
        caps.recordDatasetSuccess(alias, caps.resolvedVersionFromHeader(r.res.headers["x-datasets"], alias));
        const files = r.parsed && typeof r.parsed === "object" ? Object.keys(r.parsed) : [];
        log({ name: `4Wings report: ${alias}`, ok: true, summary: `content-type=${r.res.contentType}; isi: ${files.join(", ") || "(json langsung)"}; x-datasets=${r.res.headers["x-datasets"] ?? "-"}` });
      } else {
        caps.recordDatasetFailure(alias, r.error.code, r.error.detail, r.error.code === "INVALID_REQUEST");
        log({ name: `4Wings report: ${alias}`, ok: false, summary: `${r.error.code} ${r.error.status}: ${r.error.detail ?? ""}` });
        if (r.error.code === "REPORT_IN_PROGRESS" || r.error.code === "RATE_LIMITED") break;
      }
    }
  }

  const budget = http.budgetToday();
  console.log(`\nRequest upstream hari ini (UTC ${budget.day}): ${budget.upstreamRequests}/${budget.limit}`);
  console.log(`Fixture tersimpan di ${FIXTURE_DIR}`);
  const failed = steps.filter((s) => !s.ok).length;
  console.log(`${steps.length - failed}/${steps.length} langkah OK`);
}

void main();
