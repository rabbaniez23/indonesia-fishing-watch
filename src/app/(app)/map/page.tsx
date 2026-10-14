import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportLoader } from "@/components/analysis/ReportLoader";
import { MapExplorer, type LayerStatus } from "@/components/map/MapExplorer";
import { StateView } from "@/components/ui/StateView";
import type { CellsResult } from "@/lib/analysis/aggregate";
import { loadPart } from "@/lib/analysis/overview";
import { addDays, defaultFilter, parseFilter, todayUtc } from "@/lib/analysis/period";
import { can } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { isMapLayerKey, MAP_LAYER_KEYS, type MapLayerKey } from "@/lib/map/layers";
import { listRegions } from "@/lib/regions";

export const metadata: Metadata = { title: "Peta" };

export default function MapPage({ searchParams }: PageProps<"/map">) {
  return (
    <>
      <h1 className="sr-only">Peta aktivitas</h1>
      <Suspense fallback={<StateView state="loading" title="Memuat peta…" className="m-4" />}>
        <MapContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function parseCell(value: unknown): { lat: number; lon: number } | null {
  if (typeof value !== "string") return null;
  const [lat, lon] = value.split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}

async function MapContent({ searchParams }: { searchParams: PageProps<"/map">["searchParams"] }) {
  const user = await requireUser();
  const sp = await searchParams;
  const regions = listRegions().filter((r) => r.analyzable);
  if (regions.length === 0) {
    return (
      <StateView state="gated" title="Belum ada wilayah tervalidasi" className="m-4">
        Layer peta hanya ditampilkan untuk geometri cakupan yang sah. Admin perlu menjalankan <code>npm run regions:import</code>.
      </StateView>
    );
  }
  const { filter } = parseFilter(sp, regions.map((r) => r.id));
  const region = regions.find((r) => r.id === filter.regionId)!;
  const activeLayer: MapLayerKey = isMapLayerKey(sp.layer) ? sp.layer : "fishingEffort";
  const defaults = defaultFilter(regions[0].id);

  const parts = Object.fromEntries(
    MAP_LAYER_KEYS.map((key) => [
      key,
      loadPart<CellsResult>(
        { dataset: key, kind: "cells", regionId: filter.regionId, start: filter.start, end: filter.end },
        region.geometryHash,
      ),
    ]),
  ) as Record<MapLayerKey, ReturnType<typeof loadPart<CellsResult>>>;

  const layers = Object.fromEntries(
    MAP_LAYER_KEYS.map((key) => {
      const part = parts[key];
      const status: LayerStatus = { key, status: part.status, resultId: part.result?.id ?? null, error: part.error };
      return [key, status];
    }),
  ) as Record<MapLayerKey, LayerStatus>;

  // Hanya layer aktif yang diantre otomatis (report keberadaan bisa berat); layer gagal lewat "Coba lagi".
  const active = parts[activeLayer];
  const pending = active.status !== "ready" && !active.error ? [active.params] : [];
  const failed = active.error ? [active.params] : [];

  return (
    <MapExplorer
      key={`${region.id}:${filter.from}:${filter.to}`}
      region={{ id: region.id, name: region.name, bbox: region.bbox, source: region.source }}
      filter={{ regionId: filter.regionId, from: filter.from, to: filter.to, days: filter.days }}
      regions={regions.map((r) => ({ id: r.id, name: r.name }))}
      defaults={{ regionId: defaults.regionId, from: defaults.from, to: defaults.to }}
      maxDate={addDays(todayUtc(), -1)}
      layers={layers}
      activeLayer={activeLayer}
      initialCell={parseCell(sp.cell)}
      statusSlot={<ReportLoader pending={pending} failed={failed} total={1} />}
      canCreateFinding={can(user.role, "finding:create")}
    />
  );
}
