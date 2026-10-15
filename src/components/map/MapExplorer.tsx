"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent, Popup } from "maplibre-gl";
import { Crosshair, Layers, Moon, Sun, X } from "lucide-react";
import { ProvenanceDetails } from "@/components/analysis/ProvenanceDetails";
import { SaveFindingButton } from "@/components/findings/SaveFindingButton";
import { FilterBar } from "@/components/filters/FilterBar";
import { Badge, type StatusTone } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button, IconButton } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { DetailDrawer } from "@/components/ui/DetailDrawer";
import { StateView } from "@/components/ui/StateView";
import type { CellDetail, MapCellsPayload } from "@/lib/map/cells";
import type { Bins } from "@/lib/map/bins";
import { CELL_HALF_DEG, MAP_LAYER_KEYS, MAP_LAYERS, type MapLayerKey } from "@/lib/map/layers";
import { cn } from "@/lib/cn";
import { formatCount, formatDateRangeUTC, formatHours, formatLatLon } from "@/lib/format";
import type { OceanVarKey } from "@/lib/oseanografi/types";
import type { DensityKey } from "@/lib/viirs/grid";
import { OceanLayerControl, parseOceanParam, syncOceanToUrl, useOceanOverlay } from "./OceanOverlay";
import { parseViirsParam, syncViirsToUrl, useViirsOverlay, ViirsLayerControl, VIIRS_PERIOD } from "./ViirsOverlay";

/**
 * Basemap OpenFreeMap (gratis, tanpa API key; atribusi OpenMapTiles & OpenStreetMap ditampilkan MapLibre).
 * Gelap (bawaan): sel digambar sebagai titik bercahaya. Terang: kotak berwarna (DS §8.1).
 */
type MapTheme = "dark" | "light";
const BASEMAP: Record<MapTheme, { style: string; sea: string; land: string; region: string; outline: string }> = {
  dark: { style: "https://tiles.openfreemap.org/styles/dark", sea: "#121416", land: "#2A2C2E", region: "#4ADE80", outline: "#FFFFFF" },
  light: { style: "https://tiles.openfreemap.org/styles/positron", sea: "#EEF4F1", land: "#E0E9E1", region: "#166534", outline: "#172B22" },
};
const PANEL_W = 280;
const DRAWER_W = 360;
const MIN_MAP_W = 600;

export type LayerStatus = {
  key: MapLayerKey;
  status: "ready" | "stale" | "pending" | "failed";
  resultId: string | null;
  error: { code: string; message: string } | null;
};

type MapExplorerProps = {
  region: { id: string; name: string; bbox: [number, number, number, number]; source: string };
  filter: { regionId: string; from: string; to: string; days: number };
  regions: Array<{ id: string; name: string }>;
  defaults: { regionId: string; from: string; to: string };
  maxDate: string;
  layers: Record<MapLayerKey, LayerStatus>;
  activeLayer: MapLayerKey;
  initialCell: { lat: number; lon: number } | null;
  /** Status antrean report (ReportLoader) — selalu terpasang agar polling tetap berjalan. */
  statusSlot: ReactNode;
  /** Peran boleh membuat temuan (diperiksa ulang di server). */
  canCreateFinding: boolean;
};

const STATUS_BADGE: Record<LayerStatus["status"], { tone: StatusTone; label: string }> = {
  ready: { tone: "success", label: "Siap" },
  stale: { tone: "warning", label: "Hasil tersimpan" },
  pending: { tone: "info", label: "Memuat" },
  failed: { tone: "error", label: "Gagal" },
};

function formatValue(layer: MapLayerKey, value: number) {
  return MAP_LAYERS[layer].format === "hours" ? formatHours(value) : formatCount(value);
}

function binLabels(layer: MapLayerKey, bins: Bins): string[] {
  const f = (v: number) => formatValue(layer, v);
  const edges = [bins.min, ...bins.thresholds];
  return edges.map((lo, i) => (i < edges.length - 1 ? `${f(lo)} – < ${f(edges[i + 1])}` : `≥ ${f(lo)} (maks. ${f(bins.max)})`));
}

function cellsToGeoJSON(flat: number[]) {
  const features = [];
  for (let i = 0; i < flat.length; i += 3) {
    const lat = flat[i];
    const lon = flat[i + 1];
    const w = lon - CELL_HALF_DEG, e = lon + CELL_HALF_DEG, s = lat - CELL_HALF_DEG, n = lat + CELL_HALF_DEG;
    features.push({
      type: "Feature" as const,
      id: i / 3,
      properties: { lat, lon, v: flat[i + 2] },
      geometry: { type: "Polygon" as const, coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
    });
  }
  return { type: "FeatureCollection" as const, features };
}

function rampFor(layer: MapLayerKey, theme: MapTheme) {
  return theme === "dark" ? MAP_LAYERS[layer].rampDark : MAP_LAYERS[layer].ramp;
}

function cellsToPoints(flat: number[]) {
  const features = [];
  for (let i = 0; i < flat.length; i += 3) {
    features.push({
      type: "Feature" as const,
      id: i / 3,
      properties: { v: flat[i + 2] },
      geometry: { type: "Point" as const, coordinates: [flat[i + 1], flat[i]] },
    });
  }
  return { type: "FeatureCollection" as const, features };
}

/** Jari-jari titik ≈ ¾ setengah kotak 0,1° di zoom ≥ 6 (tidak saling tumpuk); kelas teramai sedikit lebih besar. */
function dotRadiusExpression(bins: Bins | null, scale = 1): unknown {
  const factor: unknown[] = ["step", ["get", "v"], 0.8];
  bins?.thresholds.forEach((t, i) => factor.push(t, 0.8 + 0.1 * (i + 1)));
  const f = bins ? factor : 1;
  return ["interpolate", ["exponential", 2], ["zoom"], 3, ["*", 1.6 * scale, f], 5, ["*", 2.4 * scale, f], 6, ["*", 3.4 * scale, f], 11, ["*", 108 * scale, f]];
}

function fillColorExpression(layer: MapLayerKey, bins: Bins | null, theme: MapTheme = "light"): unknown {
  const ramp = rampFor(layer, theme);
  if (!bins) return ramp[0];
  const expr: unknown[] = ["step", ["get", "v"], ramp[0]];
  bins.thresholds.forEach((t, i) => expr.push(t, ramp[Math.min(ramp.length - 1, i + 1)]));
  return expr;
}

export function MapExplorer({ region, filter, regions, defaults, maxDate, layers, activeLayer, initialCell, statusSlot, canCreateFinding }: MapExplorerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rootRef = useRef<HTMLDivElement>(null);
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [regionError, setRegionError] = useState(false);
  const [rootWidth, setRootWidth] = useState(1200);
  /** null = otomatis (terbuka di desktop, tertutup di mobile); boolean = pilihan pengguna. */
  const [panelPref, setPanelPref] = useState<boolean | null>(null);
  const [opacity, setOpacity] = useState(0.85);
  // Gaya peta disimpan di URL (?gaya=terang) agar konsisten saat dibagikan; bawaan gelap.
  const [theme, setTheme] = useState<MapTheme>(() => (searchParams.get("gaya") === "terang" ? "light" : "dark"));
  // Posisi kamera dipertahankan saat peta dibuat ulang karena ganti gaya.
  const viewRef = useRef<{ regionId: string; center: [number, number]; zoom: number } | null>(null);
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [fetched, setFetched] = useState<{ resultId: string; data: MapCellsPayload | null; error: string | null } | null>(null);
  const [selected, setSelected] = useState<{ lat: number; lon: number } | null>(initialCell);
  const [detailFetch, setDetailFetch] = useState<{ key: string; detail: CellDetail | null; error: boolean } | null>(null);
  const [showTable, setShowTable] = useState(false);
  // Lapisan tambahan VIIRS (bawaan mati); pilihan kelas disimpan di URL (?viirs=...).
  const [viirs, setViirs] = useState<DensityKey | null>(() => parseViirsParam(searchParams.get("viirs")));
  // Lapisan laut Copernicus (bawaan mati); variabel disimpan di URL (?laut=sst).
  const [ocean, setOcean] = useState<OceanVarKey | null>(() => parseOceanParam(searchParams.get("laut")));
  const [oceanOpacity, setOceanOpacity] = useState(0.6);

  // Pilihan layer ditampilkan langsung (optimistis) selama server merender ulang.
  const [layerPending, startLayerTransition] = useTransition();
  const [requestedLayer, setRequestedLayer] = useState<MapLayerKey | null>(null);
  const shownLayer = layerPending && requestedLayer ? requestedLayer : activeLayer;
  const layerDef = MAP_LAYERS[activeLayer];
  const layerStatus = layers[activeLayer];
  const isMobile = rootWidth < 768;
  const panelOpen = panelPref ?? !isMobile;
  const setPanelOpen = (open: boolean | ((v: boolean) => boolean)) =>
    setPanelPref(typeof open === "function" ? open(panelOpen) : open);
  // DS §6.2: bila dua panel membuat area peta < 600px, hanya satu panel terbuka (detail diutamakan).
  const panelVisible = panelOpen && !(selected && !isMobile && rootWidth - PANEL_W - DRAWER_W < MIN_MAP_W);

  // Ukuran root untuk aturan panel.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setRootWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // URL: simpan sel terpilih (nonrahasia) tanpa render ulang server.
  const syncCellToUrl = useCallback((cell: { lat: number; lon: number } | null) => {
    const url = new URL(window.location.href);
    if (cell) url.searchParams.set("cell", `${cell.lat},${cell.lon}`);
    else url.searchParams.delete("cell");
    window.history.replaceState(null, "", url);
  }, []);

  const selectCell = useCallback(
    (cell: { lat: number; lon: number } | null) => {
      setSelected(cell);
      syncCellToUrl(cell);
    },
    [syncCellToUrl],
  );

  // bbox berupa array baru di setiap render server; pakai kunci string agar peta tidak dibuat ulang saat refresh.
  const bboxKey = region.bbox.join(",");

  const mapKey = `${region.id}|${bboxKey}|${theme}`;
  const mapReady = readyKey === mapKey;

  function toggleTheme() {
    const next: MapTheme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    const url = new URL(window.location.href);
    if (next === "light") url.searchParams.set("gaya", "terang");
    else url.searchParams.delete("gaya");
    window.history.replaceState(null, "", url);
  }

  // Inisialisasi MapLibre (client-only). Dibuat ulang saat wilayah atau gaya peta berganti.
  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        maplibre.setWorkerUrl(`/vendor/maplibre-gl-worker-${maplibre.getVersion()}.mjs`);
        if (cancelled || !mapNode.current) return;
        const base = BASEMAP[theme];
        const saved = viewRef.current?.regionId === region.id ? viewRef.current : null;
        map = new maplibre.Map({
          container: mapNode.current,
          style: base.style,
          ...(saved
            ? { center: saved.center, zoom: saved.zoom }
            : { bounds: bboxKey.split(",").map(Number) as [number, number, number, number], fitBoundsOptions: { padding: 24 } }),
          maxZoom: 11,
          dragRotate: false,
          pitchWithRotate: false,
          attributionControl: { compact: true },
        });
        map.touchZoomRotate.disableRotation();
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        map.addControl(new maplibre.FullscreenControl(), "top-right");
        map.addControl(new maplibre.ScaleControl({ unit: "metric" }), "bottom-right");
        popupRef.current = new maplibre.Popup({ closeButton: false, closeOnClick: false, offset: 8, className: "ifw-map-tooltip" });
        map.on("error", (e) => {
          // Tile basemap gagal tidak membuat layer data dianggap kosong; catat untuk banner.
          if (e?.error?.message && /style|Failed to fetch/i.test(e.error.message)) setMapError("Basemap tidak dapat dimuat.");
        });
        map.on("moveend", () => {
          if (!map) return;
          const c = map.getCenter();
          viewRef.current = { regionId: region.id, center: [c.lng, c.lat], zoom: map.getZoom() };
        });
        map.on("load", () => {
          if (!map) return;
          const dark = theme === "dark";
          if (map.getLayer("water")) map.setPaintProperty("water", "fill-color", base.sea);
          if (map.getLayer("background")) map.setPaintProperty("background", "background-color", base.land);
          if (dark) {
            // Label bawaan style gelap terlalu redup; naikkan kontrasnya.
            for (const l of map.getStyle().layers ?? []) {
              if (l.type !== "symbol") continue;
              if (l.id.startsWith("place_")) map.setPaintProperty(l.id, "text-color", "#B4B8BC");
              if (l.id === "water_name") {
                map.setPaintProperty(l.id, "text-color", "#6B7680");
                map.setPaintProperty(l.id, "text-halo-color", "#121416");
              }
            }
          }
          const firstSymbol = map.getStyle().layers?.find((l) => l.type === "symbol")?.id;
          const empty = { type: "FeatureCollection" as const, features: [] };
          map.addSource("region", { type: "geojson", data: empty });
          map.addSource("cells", { type: "geojson", data: empty });
          map.addSource("cell-points", { type: "geojson", data: empty });
          map.addLayer({ id: "region-fill", type: "fill", source: "region", paint: { "fill-color": base.region, "fill-opacity": dark ? 0.04 : 0.06 } }, firstSymbol);
          // Mode gelap: kotak tetap ada (transparan) sebagai area klik/hover; yang terlihat titik bercahaya.
          map.addLayer({ id: "cells-fill", type: "fill", source: "cells", paint: { "fill-color": "#cccccc", "fill-opacity": dark ? 0 : 0.85 } }, firstSymbol);
          if (dark) {
            map.addLayer({ id: "cells-glow", type: "circle", source: "cell-points", paint: { "circle-color": "#cccccc", "circle-blur": 1, "circle-opacity": 0.3 } }, firstSymbol);
            map.addLayer({ id: "cells-dot", type: "circle", source: "cell-points", paint: { "circle-color": "#cccccc", "circle-opacity": 0.85 } }, firstSymbol);
          }
          map.addLayer({
            id: "cells-hover",
            type: "line",
            source: "cells",
            paint: { "line-color": base.outline, "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 1, 0] },
          }, firstSymbol);
          map.addLayer({ id: "cells-selected", type: "line", source: "cells", filter: ["==", ["id"], -1], paint: { "line-color": base.outline, "line-width": 2.5 } }, firstSymbol);
          map.addLayer({ id: "region-line", type: "line", source: "region", paint: { "line-color": base.region, "line-width": dark ? 1.5 : 2, "line-opacity": dark ? 0.75 : 1 } }, firstSymbol);
          setReadyKey(`${region.id}|${bboxKey}|${theme}`);
        });
        mapRef.current = map;
      } catch {
        setMapError("Peta tidak dapat dimulai di browser ini (WebGL diperlukan).");
      }
    })();
    return () => {
      cancelled = true;
      popupRef.current?.remove();
      map?.remove();
      mapRef.current = null;
    };
    // Peta dibuat sekali per wilayah & gaya (bboxKey mewakili isi bbox).
  }, [region.id, bboxKey, theme]);

  // Garis batas wilayah tervalidasi.
  useEffect(() => {
    if (!mapReady) return;
    let cancelled = false;
    fetch(`/api/regions/${encodeURIComponent(region.id)}/geometry`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((geojson) => {
        if (!cancelled) (mapRef.current?.getSource("region") as GeoJSONSource | undefined)?.setData(geojson);
      })
      .catch(() => !cancelled && setRegionError(true));
    return () => {
      cancelled = true;
    };
  }, [mapReady, region.id]);

  // Data sel untuk layer aktif (snapshot immutable). State diturunkan dari resultId agar tidak setState sinkron di effect.
  const resultId = layerStatus.resultId;
  useEffect(() => {
    if (!resultId) return;
    let cancelled = false;
    fetch(`/api/map/cells/${resultId}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok || !body.ok) throw new Error(body?.error?.message ?? `HTTP ${r.status}`);
        return body.data as MapCellsPayload;
      })
      .then((payload) => !cancelled && setFetched({ resultId, data: payload, error: null }))
      .catch((e: Error) => !cancelled && setFetched({ resultId, data: null, error: e.message }));
    return () => {
      cancelled = true;
    };
  }, [resultId]);
  const current = resultId && fetched?.resultId === resultId ? fetched : null;
  const data = current?.data ?? null;
  const dataError = current?.error ?? null;

  const viirsOverlay = useViirsOverlay({ mapRef, popupRef, mapReady, theme, selection: viirs });
  function changeViirs(key: DensityKey | null) {
    setViirs(key);
    syncViirsToUrl(key);
  }

  const oceanOverlay = useOceanOverlay({ mapRef, popupRef, mapReady, theme, selection: ocean, filter, opacity: oceanOpacity });
  function changeOcean(key: OceanVarKey | null) {
    setOcean(key);
    syncOceanToUrl(key);
  }

  const geojson = useMemo(() => (data ? cellsToGeoJSON(data.cells) : null), [data]);
  const points = useMemo(() => (data ? cellsToPoints(data.cells) : null), [data]);
  const featureIndex = useMemo(() => {
    const m = new Map<string, number>();
    if (data) for (let i = 0; i < data.cells.length; i += 3) m.set(`${data.cells[i]},${data.cells[i + 1]}`, i / 3);
    return m;
  }, [data]);

  // Tampilkan sel di peta.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const source = map.getSource("cells") as GeoJSONSource | undefined;
    source?.setData(geojson ?? { type: "FeatureCollection", features: [] });
    const bins = data?.bins ?? null;
    if (theme === "dark") {
      (map.getSource("cell-points") as GeoJSONSource | undefined)?.setData(points ?? { type: "FeatureCollection", features: [] });
      const color = fillColorExpression(activeLayer, bins, "dark") as never;
      map.setPaintProperty("cells-dot", "circle-color", color);
      map.setPaintProperty("cells-glow", "circle-color", color);
      map.setPaintProperty("cells-dot", "circle-radius", dotRadiusExpression(bins) as never);
      map.setPaintProperty("cells-glow", "circle-radius", dotRadiusExpression(bins, 2.4) as never);
    } else {
      map.setPaintProperty("cells-fill", "fill-color", fillColorExpression(activeLayer, bins) as never);
    }
  }, [mapReady, geojson, points, data, activeLayer, theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    if (theme === "dark") {
      map.setPaintProperty("cells-dot", "circle-opacity", opacity);
      map.setPaintProperty("cells-glow", "circle-opacity", opacity * 0.35);
    } else {
      map.setPaintProperty("cells-fill", "fill-opacity", opacity);
    }
  }, [mapReady, opacity, theme]);

  // Sorot sel terpilih.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const id = selected ? featureIndex.get(`${selected.lat},${selected.lon}`) ?? -1 : -1;
    map.setFilter("cells-selected", ["==", ["id"], id]);
  }, [mapReady, selected, featureIndex]);

  // Hover tooltip singkat + klik untuk detail.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    let hoverId: number | null = null;
    const onMove = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      if (hoverId !== null) map.setFeatureState({ source: "cells", id: hoverId }, { hover: false });
      hoverId = f.id as number;
      map.setFeatureState({ source: "cells", id: hoverId }, { hover: true });
      map.getCanvas().style.cursor = "pointer";
      const { v } = f.properties as { v: number };
      popupRef.current
        ?.setLngLat(e.lngLat)
        .setHTML(`<strong>${formatValue(activeLayer, v)} ${MAP_LAYERS[activeLayer].unit}</strong><br/><span>Klik untuk detail</span>`)
        .addTo(map);
    };
    const onLeave = () => {
      if (hoverId !== null) map.setFeatureState({ source: "cells", id: hoverId }, { hover: false });
      hoverId = null;
      map.getCanvas().style.cursor = "";
      popupRef.current?.remove();
    };
    const onClick = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      const { lat, lon } = f.properties as { lat: number; lon: number };
      selectCell({ lat, lon });
    };
    map.on("mousemove", "cells-fill", onMove);
    map.on("mouseleave", "cells-fill", onLeave);
    map.on("click", "cells-fill", onClick);
    return () => {
      map.off("mousemove", "cells-fill", onMove);
      map.off("mouseleave", "cells-fill", onLeave);
      map.off("click", "cells-fill", onClick);
    };
  }, [mapReady, activeLayer, selectCell]);

  // Detail sel terpilih (state diturunkan dari kunci permintaan).
  const detailKey = selected && resultId ? `${resultId}:${selected.lat},${selected.lon}` : null;
  useEffect(() => {
    if (!detailKey || !selected || !resultId) return;
    let cancelled = false;
    fetch(`/api/map/cells/${resultId}?lat=${selected.lat}&lon=${selected.lon}`)
      .then(async (r) => {
        const body = await r.json();
        if (r.status === 404) return null;
        if (!r.ok || !body.ok) throw new Error(body?.error?.message);
        return body.data as CellDetail;
      })
      .then((d) => !cancelled && setDetailFetch({ key: detailKey, detail: d, error: false }))
      .catch(() => !cancelled && setDetailFetch({ key: detailKey, detail: null, error: true }));
    return () => {
      cancelled = true;
    };
  }, [detailKey, selected, resultId]);
  const detailCurrent = detailKey && detailFetch?.key === detailKey ? detailFetch : null;
  const detail = detailCurrent?.detail ?? null;
  const detailState: "idle" | "loading" | "error" = !detailKey ? "idle" : !detailCurrent ? "loading" : detailCurrent.error ? "error" : "idle";

  function flyToCell(cell: { lat: number; lon: number }) {
    selectCell(cell);
    mapRef.current?.flyTo({ center: [cell.lon, cell.lat], zoom: Math.max(mapRef.current.getZoom(), 7) });
    if (isMobile) setPanelOpen(false);
  }

  function changeLayer(key: MapLayerKey) {
    if (key === shownLayer) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("layer", key);
    params.delete("cell");
    setSelected(null);
    setRequestedLayer(key);
    startLayerTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  const topCells = useMemo(() => {
    if (!data) return [];
    const rows: Array<{ rank: number; lat: number; lon: number; value: number }> = [];
    for (let i = 0; i < Math.min(data.cells.length, 50 * 3); i += 3) {
      rows.push({ rank: i / 3 + 1, lat: data.cells[i], lon: data.cells[i + 1], value: data.cells[i + 2] });
    }
    return rows;
  }, [data]);

  const panel = (
    <div className="flex flex-col gap-5 p-4">
      <section aria-labelledby="judul-filter-peta" className="flex flex-col gap-3">
        <h2 id="judul-filter-peta" className="text-card-title font-semibold">
          Wilayah &amp; periode
        </h2>
        <FilterBar regions={regions} applied={filter} defaults={defaults} maxDate={maxDate} layout="stacked" />
      </section>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-card-title font-semibold">Tampilkan di peta</legend>
        <p className="text-caption text-ink-muted">
          Pilih satu jenis data. {theme === "dark" ? "Makin terang titiknya" : "Makin gelap warnanya"}, makin ramai aktivitasnya.
        </p>
        {MAP_LAYER_KEYS.map((key) => {
          const def = MAP_LAYERS[key];
          // Layer tidak aktif belum diantre (diambil saat dipilih) — jangan ditandai "Memuat".
          const st =
            key !== shownLayer && layers[key].status === "pending"
              ? { tone: "neutral" as const, label: "Belum dimuat" }
              : STATUS_BADGE[layers[key].status];
          return (
            <label
              key={key}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-button border px-3 py-2",
                key === shownLayer ? "border-primary bg-primary-soft" : "border-border hover:bg-surface-subtle",
              )}
            >
              <input type="radio" name="map-layer" value={key} checked={key === shownLayer} onChange={() => changeLayer(key)} className="size-4 accent-[var(--color-primary)]" />
              <RampSwatch ramp={rampFor(key, theme)} className="h-3 w-6" />
              <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                <span className="font-medium">{def.label}</span>
                <span className="flex flex-wrap items-center gap-2 text-caption text-ink-muted">
                  {def.unit}
                  <Badge tone={st.tone}>{st.label}</Badge>
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <ViirsLayerControl selection={viirs} onChange={changeViirs} status={viirsOverlay.status} max={viirsOverlay.max} theme={theme} />
      <OceanLayerControl selection={ocean} onChange={changeOcean} overlay={oceanOverlay} opacity={oceanOpacity} onOpacityChange={setOceanOpacity} />

      <div className="flex flex-col gap-1">
        <label htmlFor="opacity" className="font-medium">
          Kepekatan warna: {Math.round(opacity * 100)}%
        </label>
        <input id="opacity" type="range" min={0.3} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="h-11 accent-[var(--color-primary)]" />
      </div>

      {data ? (
        <section aria-labelledby="judul-ringkas-peta" className="flex flex-col gap-2">
          <h2 id="judul-ringkas-peta" className="text-card-title font-semibold">
            Ringkasan
          </h2>
          <p className="text-ink-muted">
            {formatCount(data.cellCount)} kotak beraktivitas · total {formatValue(activeLayer, data.total)} {layerDef.unit}.
            {topCells[0]
              ? ` Paling ramai ${formatValue(activeLayer, topCells[0].value)} ${layerDef.unit} di ${formatLatLon(topCells[0].lat, topCells[0].lon)}.`
              : ""}
          </p>
          <Button variant="secondary" size="compact" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable}>
            {showTable ? "Sembunyikan daftar" : "Lihat 50 lokasi teramai"}
          </Button>
          {showTable ? (
            <DataTable
              caption={`50 lokasi teramai · ${layerDef.metricLabel}`}
              rows={topCells}
              rowKey={(r) => `${r.lat},${r.lon}`}
              columns={[
                { key: "rank", header: "#", align: "right", cell: (r) => r.rank },
                { key: "loc", header: "Lokasi", cell: (r) => <span className="text-caption">{formatLatLon(r.lat, r.lon)}</span> },
                { key: "v", header: layerDef.unit, align: "right", cell: (r) => formatValue(activeLayer, r.value) },
                {
                  key: "go",
                  header: "Aksi",
                  cell: (r) => (
                    <button type="button" className="font-medium text-primary underline underline-offset-2" onClick={() => flyToCell(r)}>
                      Lihat
                    </button>
                  ),
                },
              ]}
            />
          ) : null}
        </section>
      ) : null}

      <p className="text-caption text-ink-muted">
        Batas: {region.name} — {region.source}. Aktivitas berasal dari report GFW untuk wilayah ini, bukan tile global.
      </p>
    </div>
  );

  return (
    <div ref={rootRef} className="relative flex h-[calc(100dvh-4rem)] min-h-[520px] w-full overflow-hidden">
      {/* Panel layer & filter: kiri 280px (desktop), sheet layar penuh (mobile). */}
      {panelVisible ? (
        isMobile ? (
          <div role="dialog" aria-modal="true" aria-label="Pengaturan peta" className="fixed inset-0 z-50 flex flex-col bg-surface">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <p className="text-section-title font-semibold">Layer &amp; filter</p>
              <IconButton label="Tutup pengaturan peta" icon={<X className="size-5" aria-hidden />} onClick={() => setPanelOpen(false)} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{panel}</div>
          </div>
        ) : (
          <aside aria-label="Pengaturan peta" className="glass-strong z-20 w-[280px] shrink-0 overflow-y-auto border-r">
            {panel}
          </aside>
        )
      ) : null}

      <div className="relative min-w-0 flex-1">
        {/* MapLibre memberi kontainer `position: relative` (.maplibregl-map), jadi posisi absolut ada di pembungkus. */}
        <div className="absolute inset-0">
          <div ref={mapNode} className="h-full w-full" aria-label={`Peta ${layerDef.metricLabel}, ${region.name}`} role="region" />
        </div>

        <div className="pointer-events-none absolute inset-x-3 top-3 z-30 flex flex-col gap-2 pr-14">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="compact"
              className="shadow-card"
              icon={<Layers className="size-4" aria-hidden />}
              onClick={() => setPanelOpen((v) => !v)}
              aria-expanded={panelVisible}
            >
              {panelVisible ? "Sembunyikan panel" : "Pengaturan peta"}
            </Button>
            <Button
              variant="secondary"
              size="compact"
              className="shadow-card"
              icon={<Crosshair className="size-4" aria-hidden />}
              onClick={() => mapRef.current?.fitBounds(region.bbox, { padding: 24 })}
            >
              Reset ke wilayah
            </Button>
            <Button
              variant="secondary"
              size="compact"
              className="shadow-card"
              icon={theme === "dark" ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
              onClick={toggleTheme}
            >
              {theme === "dark" ? "Peta terang" : "Peta gelap"}
            </Button>
            <span className="glass-strong rounded-full border px-3 py-1 text-caption text-ink">
              {layerDef.label} · {formatDateRangeUTC(filter.from, filter.to)}
            </span>
            {viirs ? (
              <span className="glass-strong rounded-full border px-3 py-1 text-caption text-ink">+ VIIRS · {VIIRS_PERIOD}</span>
            ) : null}
            {ocean && oceanOverlay.meta ? (
              <span className="glass-strong rounded-full border px-3 py-1 text-caption text-ink">
                + Laut · {oceanOverlay.meta.label} · {oceanOverlay.month}
              </span>
            ) : null}
          </div>
          <div className="pointer-events-auto max-w-xl">{statusSlot}</div>
          <div className="pointer-events-auto max-w-xl" aria-live="polite">
            {mapError ? <Banner tone="error" title={mapError} /> : null}
            {regionError ? <Banner tone="error" title="Garis batas wilayah gagal dimuat." /> : null}
            {layerStatus.status === "failed" && !data ? (
              <Banner tone="error" title={`Data ${layerDef.label.toLowerCase()} gagal dimuat (${layerStatus.error?.code ?? "galat"}).`}>
                Area peta tanpa sel bukan berarti tidak ada aktivitas.
              </Banner>
            ) : null}
            {dataError ? <Banner tone="error" title="Data peta belum bisa dimuat.">{dataError}</Banner> : null}
            {layerStatus.status === "stale" ? <Banner tone="warning" title="Menampilkan data tersimpan terakhir; pembaruan belum berhasil." /> : null}
          </div>
        </div>

        {layerStatus.status === "pending" && !data ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <StateView state="loading" title={`Memuat data ${layerDef.label.toLowerCase()}…`} className="glass-strong pointer-events-auto border-solid" />
          </div>
        ) : null}

        {data ? <Legend layer={activeLayer} data={data} theme={theme} defaultOpen={!isMobile} /> : null}

        <DetailDrawer
          open={!!selected}
          onClose={() => selectCell(null)}
          title="Detail lokasi"
          subtitle={`${layerDef.metricLabel} · ${formatDateRangeUTC(filter.from, filter.to)}`}
          actions={
            detail && resultId ? (
              <SaveFindingButton
                canCreate={canCreateFinding}
                filter={{ regionId: filter.regionId, from: filter.from, to: filter.to }}
                defaultTitle={`${layerDef.metricLabel} tinggi di ${formatLatLon(detail.lat, detail.lon)}`}
                source={{
                  type: "cell",
                  resultId,
                  layer: activeLayer,
                  lat: detail.lat,
                  lon: detail.lon,
                  value: detail.value,
                  unit: layerDef.unit,
                  datasetResolved: detail.provenance.datasetResolved,
                  fetchedAt: detail.provenance.fetchedAt,
                }}
              />
            ) : undefined
          }
        >
          <CellDetailBody layer={activeLayer} detail={detail} state={detailState} />
        </DetailDrawer>
      </div>
    </div>
  );
}

function RampSwatch({ ramp, className }: { ramp: readonly string[]; className?: string }) {
  return <span aria-hidden className={cn("shrink-0 rounded-sm", className)} style={{ background: `linear-gradient(90deg, ${ramp[0]}, ${ramp[ramp.length - 1]})` }} />;
}

function Legend({ layer, data, theme, defaultOpen }: { layer: MapLayerKey; data: MapCellsPayload; theme: MapTheme; defaultOpen: boolean }) {
  const def = MAP_LAYERS[layer];
  const ramp = rampFor(layer, theme);
  const dark = theme === "dark";
  const labels = data.bins ? binLabels(layer, data.bins) : [];
  // null = ikuti default (terbuka di desktop, terlipat di mobile agar tidak menutupi peta).
  const [pref, setPref] = useState<boolean | null>(null);
  const open = pref ?? defaultOpen;
  return (
    <div className="glass-strong absolute bottom-8 left-3 z-20 w-[min(300px,calc(100%-24px))] rounded-button border text-caption">
      <button
        type="button"
        onClick={() => setPref(!open)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2">
          <RampSwatch ramp={ramp} className="h-3 w-8" />
          <span className="font-semibold text-ink">
            {def.metricLabel} ({def.unit})
          </span>
        </span>
        <span className="text-primary">{open ? "Lipat" : "Legenda"}</span>
      </button>
      {open ? (
        <div className="px-3 pb-3">
          <p className="text-ink-muted">
            {formatDateRangeUTC(data.start, addDay(data.end, -1))} · Skala kuantil, {data.bins?.classes ?? 0} kelas
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {labels.map((label, i) => (
              <li key={label} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={cn("size-3 shrink-0", dark ? "rounded-full ring-2 ring-[#121416]" : "rounded-sm")}
                  style={{ background: ramp[Math.min(ramp.length - 1, i)] }}
                />
                <span className="tabular text-ink">{label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-ink-muted">
            {dark
              ? "Setiap titik mewakili satu kotak sekitar 11 × 11 km — bukan satu kapal dan bukan posisi tepat kapal. Area tanpa titik berarti tidak ada aktivitas tercatat."
              : "Setiap kotak berukuran sekitar 11 × 11 km dan bukan posisi tepat kapal. Area tanpa warna berarti tidak ada aktivitas tercatat."}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function addDay(day: string, n: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

function CellDetailBody({ layer, detail, state }: { layer: MapLayerKey; detail: CellDetail | null; state: "idle" | "loading" | "error" }) {
  const def = MAP_LAYERS[layer];
  if (state === "loading") return <StateView state="loading" title="Memuat detail…" />;
  if (state === "error") return <StateView state="error">Detail belum bisa dimuat.</StateView>;
  if (!detail) return <StateView state="unknown" title="Tidak ada aktivitas tercatat di kotak ini." />;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="tabular text-metric-mobile font-semibold">
          {formatValue(layer, detail.value)} <span className="text-body font-normal text-ink-muted">{def.unit}</span>
        </p>
        <p className="text-caption text-ink-muted">
          Urutan ke-{formatCount(detail.rank)} dari {formatCount(detail.cellCount)} kotak · {formatDateRangeUTC(detail.start, addDay(detail.end, -1))}
        </p>
        <p className="mt-1 text-caption text-ink-muted">{def.caveat}</p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-caption">
        <dt className="text-ink-muted">Titik tengah</dt>
        <dd>{formatLatLon(detail.lat, detail.lon)}</dd>
        <dt className="text-ink-muted">Batas kotak</dt>
        <dd>
          {formatLatLon(detail.bounds.south, detail.bounds.west)} s.d. {formatLatLon(detail.bounds.north, detail.bounds.east)}
        </dd>
      </dl>
      <div>
        <h3 className="mb-2 font-semibold">Menurut bendera kapal</h3>
        <DataTable
          caption="Aktivitas di kotak ini menurut bendera kapal"
          rows={detail.byFlag.map(([flag, value, ids], i) => ({ flag, value, ids, i }))}
          rowKey={(r) => String(r.i)}
          columns={[
            { key: "flag", header: "Bendera", cell: (r) => r.flag ?? <span className="text-ink-muted">Tidak diketahui</span> },
            { key: "v", header: def.unit, align: "right", cell: (r) => formatValue(layer, r.value) },
            { key: "ids", header: "Kapal", align: "right", cell: (r) => (r.ids === null ? "—" : formatCount(r.ids)) },
          ]}
        />
        <p className="mt-2 text-caption text-ink-muted">
          “Kapal” = jumlah identitas kapal per bendera. Satu kapal bisa muncul di lebih dari satu baris, jadi kolom ini tidak dijumlahkan.
        </p>
      </div>
      <p className="text-caption text-ink-muted">Nama kapal per kotak belum bisa ditampilkan. Cari kapalnya di menu Kapal.</p>
      <ProvenanceDetails provenance={detail.provenance} summary="Sumber data" />
    </div>
  );
}
