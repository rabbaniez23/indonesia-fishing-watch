"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent, Popup } from "maplibre-gl";
import { Pause, Play } from "lucide-react";
import { Banner } from "@/components/ui/Banner";
import { DataTable } from "@/components/ui/DataTable";
import { StateView } from "@/components/ui/StateView";
import { cn } from "@/lib/cn";
import { formatCount, formatLatLon } from "@/lib/format";
import { CLASS_COLOR, CLASS_LABEL, CLASS_RULE, MONTH_LONG, MONTH_SHORT } from "@/lib/viirs/format";
import { densityFeatures, gridCenter as center, maxOf, type DensityKey } from "@/lib/viirs/grid";
import type { ViirsDensity, ViirsMonthlyGrid } from "@/lib/viirs/types";

/**
 * Peta VIIRS: basemap gelap OpenFreeMap (atribusi ditampilkan MapLibre) + heatmap kernel dari grid jumlah deteksi.
 * Bobot tiap sel = (ln(1 + jumlah) / ln(1 + maks))², dinormalisasi per panel (paper: skala tiap kelas terpisah).
 * Warna hanya untuk tampilan; perbandingan angka memakai jumlah mentah di tooltip & tabel.
 */

const STYLE = "https://tiles.openfreemap.org/styles/dark";
const SEA = "#121416";
const LAND = "#2A2C2E";
const WPP_LINE = "#9CA3AF";
const WPP_CODES = ["571", "572", "573", "711", "712", "713", "714", "715", "716", "717", "718"];
export const INDONESIA_BOUNDS: [number, number, number, number] = [91.5, -14.2, 141.5, 9];
/** Ramp kuning-jingga (cahaya malam): satu hue, makin padat makin terang. */
const HEAT_COLOR = [
  "interpolate", ["linear"], ["heatmap-density"],
  0, "rgba(0,0,0,0)", 0.12, "#7A4210", 0.3, "#A3580C", 0.5, "#CC7008", 0.7, "#F08A12", 0.88, "#FFB347", 1, "#FFE9B8",
];
const HEAT_STOPS = ["#7A4210", "#A3580C", "#CC7008", "#F08A12", "#FFB347", "#FFE9B8"];

type Status = "loading" | "ready" | "error";

/** Peta dasar gelap + garis 11 WPP. Dibuat sekali per komponen. */
export function useBaseMap(bounds: [number, number, number, number]) {
  const node = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boundsKey = bounds.join(",");

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        maplibre.setWorkerUrl(`/vendor/maplibre-gl-worker-${maplibre.getVersion()}.mjs`);
        if (cancelled || !node.current) return;
        map = new maplibre.Map({
          container: node.current,
          style: STYLE,
          bounds: boundsKey.split(",").map(Number) as [number, number, number, number],
          fitBoundsOptions: { padding: 16 },
          maxZoom: 10,
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
          if (e?.error?.message && /style|Failed to fetch/i.test(e.error.message)) setError("Basemap tidak dapat dimuat.");
        });
        map.on("load", () => {
          if (!map) return;
          if (map.getLayer("water")) map.setPaintProperty("water", "fill-color", SEA);
          if (map.getLayer("background")) map.setPaintProperty("background", "background-color", LAND);
          for (const l of map.getStyle().layers ?? []) {
            if (l.type === "symbol" && l.id.startsWith("place_")) map.setPaintProperty(l.id, "text-color", "#B4B8BC");
          }
          map.addSource("wpp", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          setReady(true);
        });
        mapRef.current = map;
      } catch {
        setError("Peta tidak dapat dimulai di browser ini (WebGL diperlukan).");
      }
    })();
    return () => {
      cancelled = true;
      popupRef.current?.remove();
      map?.remove();
      mapRef.current = null;
    };
  }, [boundsKey]);

  // Garis batas 11 WPP dari geometri tervalidasi aplikasi.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    Promise.all(
      WPP_CODES.map((code) =>
        fetch(`/api/regions/wpp-${code}/geometry`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ),
    ).then((collections) => {
      const map = mapRef.current;
      if (cancelled || !map) return;
      const features = collections.flatMap((fc) => (fc && Array.isArray(fc.features) ? fc.features : []));
      (map.getSource("wpp") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features });
      const firstSymbol = map.getStyle().layers?.find((l) => l.type === "symbol")?.id;
      if (!map.getLayer("wpp-line")) {
        map.addLayer({ id: "wpp-line", type: "line", source: "wpp", paint: { "line-color": WPP_LINE, "line-width": 1, "line-opacity": 0.7 } }, firstSymbol);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  return { node, mapRef, popupRef, ready, error };
}

function useJson<T>(url: string) {
  const [state, setState] = useState<{ status: Status; data: T | null }>({ status: "loading", data: null });
  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: T) => !cancelled && setState({ status: "ready", data }))
      .catch(() => !cancelled && setState({ status: "error", data: null }));
    return () => {
      cancelled = true;
    };
  }, [url]);
  return state;
}

/** `radius` & `intensity`: pasangan [zoom, nilai] untuk interpolasi linear. */
function heatLayers(map: MapLibreMap, source: string, radius: number[], intensity: number[]) {
  const firstSymbol = map.getStyle().layers?.find((l) => l.type === "symbol")?.id;
  map.addLayer(
    {
      id: `${source}-heat`,
      type: "heatmap",
      source,
      paint: {
        "heatmap-weight": ["get", "w"],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], ...intensity] as never,
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], ...radius] as never,
        "heatmap-color": HEAT_COLOR as never,
        "heatmap-opacity": 0.95,
      },
    },
    firstSymbol,
  );
  // Lapisan transparan untuk hover/tooltip per sel.
  map.addLayer({ id: `${source}-hit`, type: "circle", source, filter: [">", ["get", "v"], 0], paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 3, 9, 14], "circle-opacity": 0 } });
}

function HeatLegend({ max, label }: { max: number; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-caption text-ink-muted">
      <span>Jarang</span>
      <span aria-hidden className="flex h-3 w-40 overflow-hidden rounded-[3px]">
        {HEAT_STOPS.map((c) => (
          <span key={c} className="h-full flex-1" style={{ background: c }} />
        ))}
      </span>
      <span>Padat</span>
      <span className="tabular">
        (maks. {formatCount(max)} deteksi per sel, {label})
      </span>
    </div>
  );
}

const DENSITY_OPTIONS: Array<{ key: DensityKey; label: string; hint: string }> = [
  { key: "all", label: "Semua deteksi", hint: "Fig 3" },
  { key: "low", label: `${CLASS_LABEL.low} (${CLASS_RULE.low})`, hint: "Fig 6–7" },
  { key: "medium", label: `${CLASS_LABEL.medium} (${CLASS_RULE.medium})`, hint: "Fig 6–7" },
  { key: "high", label: `${CLASS_LABEL.high} (${CLASS_RULE.high})`, hint: "Fig 6–7" },
];

/** Fig 3, 6, 7 — kepadatan deteksi (semua & per kelas radiansi), April 2012 – Mei 2026. */
export function DensityMap() {
  const { node, mapRef, popupRef, ready, error } = useBaseMap(INDONESIA_BOUNDS);
  const { status, data } = useJson<ViirsDensity>("/api/viirs/density");
  const [key, setKey] = useState<DensityKey>("all");
  const col = data ? data.columns.indexOf(key) : -1;
  const max = useMemo(() => (data && col >= 0 ? maxOf(data.cells.map((c) => c[col])) : 0), [data, col]);
  const top = useMemo(() => {
    if (!data || col < 0) return [];
    return [...data.cells].sort((a, b) => b[col] - a[col]).slice(0, 10).map((c) => ({ ...center(c, data), v: c[col], c }));
  }, [data, col]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !data || col < 0) return;
    // Normalisasi per kelas (paper Gambar 7); kelas jarang diberi intensitas lebih besar agar tetap terlihat.
    const { fc, sparse } = densityFeatures(data, key);
    const k = sparse ? 3 : 1;
    const intensity = ["interpolate", ["linear"], ["zoom"], 3, 0.3 * k, 6, 0.7 * k, 9, 1.4 * k];
    const src = map.getSource("density") as GeoJSONSource | undefined;
    if (src) {
      src.setData(fc);
      map.setPaintProperty("density-heat", "heatmap-intensity", intensity as never);
      return;
    }
    map.addSource("density", { type: "geojson", data: fc });
    // Radius ≈ 1,3 × jarak antarsel 0,1° di tiap zoom agar kernel menyatu.
    heatLayers(map, "density", [3, 2.5, 6, 12, 7, 24, 8, 48, 9, 95, 10, 190], intensity.slice(3) as number[]);
    map.on("mousemove", "density-hit", (e: MapLayerMouseEvent) => {
      const p = e.features?.[0]?.properties as Record<string, number> | undefined;
      if (!p) return;
      map.getCanvas().style.cursor = "crosshair";
      popupRef.current
        ?.setLngLat([p.lon, p.lat])
        .setHTML(
          `<strong>${formatCount(p.all)} deteksi</strong><br/><span>Sel 0,1° · ${formatLatLon(p.lat, p.lon)}</span><br/>` +
            `<span>Rendah ${formatCount(p.low)} · Sedang ${formatCount(p.medium)} · Tinggi ${formatCount(p.high)}</span>`,
        )
        .addTo(map);
    });
    map.on("mouseleave", "density-hit", () => {
      map.getCanvas().style.cursor = "";
      popupRef.current?.remove();
    });
  }, [ready, data, col, key, mapRef, popupRef]);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div role="group" aria-label="Pilih kelas radiansi" className="flex flex-wrap gap-2">
        {DENSITY_OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            aria-pressed={o.key === key}
            onClick={() => setKey(o.key)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full border px-3 transition-colors duration-150",
              o.key === key ? "border-primary bg-primary-soft font-semibold text-primary" : "border-border-control bg-surface text-ink hover:bg-surface-subtle",
            )}
          >
            {o.key !== "all" ? <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: CLASS_COLOR[o.key] }} /> : null}
            {o.label}
          </button>
        ))}
      </div>
      {error ? <Banner tone="warning" title={error} /> : null}
      {status === "error" ? (
        <StateView state="error" title="Grid kepadatan VIIRS tidak dapat dimuat" className="min-h-[300px]" />
      ) : (
        <div className="relative h-[460px] min-w-0 overflow-hidden rounded-card border border-border sm:h-[560px]">
          <div ref={node} className="h-full w-full" aria-label="Peta kepadatan deteksi kapal VIIRS" role="region" />
          {status === "loading" || !ready ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#121416]/60 text-caption text-white" role="status">
              Memuat peta…
            </div>
          ) : null}
        </div>
      )}
      <HeatLegend max={max} label={key === "all" ? "semua deteksi" : `kelas ${CLASS_LABEL[key].toLowerCase()}`} />
      <p className="text-caption text-ink-muted">
        Kepadatan dihitung dari jumlah deteksi per sel 0,1° lalu dihaluskan dengan kernel peta. Skala warna dinormalisasi per kelas, jadi
        intensitas warna hanya dapat dibandingkan di dalam kelas yang sama. Garis abu-abu: batas WPP.
      </p>
      {top.length > 0 ? (
        <details className="text-body">
          <summary className="cursor-pointer font-medium text-primary">10 sel terpadat ({key === "all" ? "semua deteksi" : `kelas ${CLASS_LABEL[key].toLowerCase()}`})</summary>
          <DataTable
            className="mt-2"
            caption="Sel grid 0,1° dengan deteksi terbanyak"
            rows={top}
            rowKey={(r) => `${r.c[0]}-${r.c[1]}`}
            columns={[
              { key: "pos", header: "Pusat sel", cell: (r) => formatLatLon(r.lat, r.lon) },
              { key: "v", header: "Deteksi", align: "right", cell: (r) => formatCount(r.v) },
            ]}
          />
        </details>
      ) : null}
    </div>
  );
}

const MONTHLY_WPP = [
  { code: "712", label: "WPP 712 · Laut Jawa", hint: "Fig 13" },
  { code: "717", label: "WPP 717 · Teluk Cenderawasih", hint: "Fig 14" },
];

/** Fig 13 & 14 — sebaran bulanan deteksi di WPP 712 dan 717 sepanjang 2025 (skala warna sama untuk 12 bulan). */
export function MonthlyGridMap() {
  const { status, data } = useJson<ViirsMonthlyGrid>("/api/viirs/monthly-grid-2025");
  const [code, setCode] = useState("712");
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div role="group" aria-label="Pilih WPP" className="flex flex-wrap gap-2">
        {MONTHLY_WPP.map((w) => (
          <button
            key={w.code}
            type="button"
            aria-pressed={w.code === code}
            onClick={() => setCode(w.code)}
            className={cn(
              "inline-flex h-9 items-center rounded-full border px-3 transition-colors duration-150",
              w.code === code ? "border-primary bg-primary-soft font-semibold text-primary" : "border-border-control bg-surface text-ink hover:bg-surface-subtle",
            )}
          >
            {w.label}
          </button>
        ))}
      </div>
      {status === "error" ? (
        <StateView state="error" title="Grid bulanan VIIRS tidak dapat dimuat" className="min-h-[300px]" />
      ) : status === "loading" || !data ? (
        <StateView state="loading" title="Memuat grid bulanan…" className="min-h-[300px]" />
      ) : (
        <MonthlyPanel key={code} grid={data} code={code} />
      )}
    </div>
  );
}

function MonthlyPanel({ grid, code }: { grid: ViirsMonthlyGrid; code: string }) {
  const wpp = grid.wpp[code];
  const bounds = useMemo<[number, number, number, number]>(() => {
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
    for (const c of wpp.cells) {
      const { lon, lat } = center(c, grid);
      w = Math.min(w, lon);
      e = Math.max(e, lon);
      s = Math.min(s, lat);
      n = Math.max(n, lat);
    }
    return [w - 0.3, s - 0.3, e + 0.3, n + 0.3];
  }, [wpp, grid]);
  const { node, mapRef, popupRef, ready, error } = useBaseMap(bounds);
  const [month, setMonth] = useState(Math.max(1, wpp.monthTotals.indexOf(Math.max(...wpp.monthTotals)) + 1));
  const [playing, setPlaying] = useState(false);
  const maxCell = useMemo(() => maxOf(wpp.cells.flatMap((c) => c.slice(2))), [wpp]);
  const maxMonth = Math.max(...wpp.monthTotals);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setMonth((m) => (m % 12) + 1), 1400);
    return () => window.clearInterval(id);
  }, [playing]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const denom = Math.log1p(maxCell) || 1;
    const col = month + 1;
    const fc = {
      type: "FeatureCollection" as const,
      features: wpp.cells
        .filter((c) => c[col] > 0)
        .map((c, i) => {
          const { lon, lat } = center(c, grid);
          return {
            type: "Feature" as const,
            id: i,
            geometry: { type: "Point" as const, coordinates: [lon, lat] },
            // Grid bulanan jauh lebih jarang (puluhan deteksi per sel): bobot log tanpa kuadrat agar tetap terlihat.
            properties: { v: c[col], w: Math.log1p(c[col]) / denom, lat, lon },
          };
        }),
    };
    const src = map.getSource("monthly") as GeoJSONSource | undefined;
    if (src) {
      src.setData(fc);
      return;
    }
    map.addSource("monthly", { type: "geojson", data: fc });
    heatLayers(map, "monthly", [4, 4, 7, 14, 10, 52], [4, 1, 7, 1.6, 10, 2.2]);
    map.on("mousemove", "monthly-hit", (e: MapLayerMouseEvent) => {
      const p = e.features?.[0]?.properties as Record<string, number> | undefined;
      if (!p) return;
      map.getCanvas().style.cursor = "crosshair";
      popupRef.current
        ?.setLngLat([p.lon, p.lat])
        .setHTML(`<strong>${formatCount(p.v)} deteksi</strong><br/><span>Sel 0,05° · ${formatLatLon(p.lat, p.lon)}</span>`)
        .addTo(map);
    });
    map.on("mouseleave", "monthly-hit", () => {
      map.getCanvas().style.cursor = "";
      popupRef.current?.remove();
    });
  }, [ready, month, wpp, grid, maxCell, mapRef, popupRef]);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-pressed={playing}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-border-control bg-surface px-3 text-ink hover:bg-surface-subtle"
        >
          {playing ? <Pause aria-hidden className="h-4 w-4" /> : <Play aria-hidden className="h-4 w-4" />}
          {playing ? "Jeda" : "Putar 12 bulan"}
        </button>
        <p className="font-semibold text-ink" role="status" aria-live="polite">
          {MONTH_LONG[month - 1]} {grid.year} · {formatCount(wpp.monthTotals[month - 1])} deteksi
        </p>
      </div>
      {/* Total per bulan sekaligus pemilih bulan. */}
      <div role="group" aria-label="Pilih bulan" className="grid grid-cols-12 items-end gap-1">
        {wpp.monthTotals.map((t, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={month === i + 1}
            aria-label={`${MONTH_LONG[i]}: ${formatCount(t)} deteksi`}
            onClick={() => {
              setPlaying(false);
              setMonth(i + 1);
            }}
            className={cn(
              "flex h-20 flex-col items-center justify-end gap-1 rounded-input px-0.5 pt-1 outline-none focus-visible:ring-2 focus-visible:ring-primary",
              month === i + 1 ? "bg-primary-soft" : "hover:bg-surface-subtle",
            )}
          >
            <span aria-hidden className="w-full max-w-6 rounded-t-[4px]" style={{ height: `${Math.max(2, (t / maxMonth) * 48)}px`, background: month === i + 1 ? "var(--color-primary)" : "#9CA3AF" }} />
            <span className={cn("text-caption", month === i + 1 ? "font-semibold text-primary" : "text-ink-muted")}>{MONTH_SHORT[i]}</span>
          </button>
        ))}
      </div>
      {error ? <Banner tone="warning" title={error} /> : null}
      <div className="relative h-[420px] min-w-0 overflow-hidden rounded-card border border-border sm:h-[500px]">
        <div ref={node} className="h-full w-full" aria-label={`Peta sebaran deteksi WPP ${code}, ${MONTH_LONG[month - 1]} ${grid.year}`} role="region" />
        {!ready ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#121416]/60 text-caption text-white" role="status">
            Memuat peta…
          </div>
        ) : null}
      </div>
      <HeatLegend max={maxCell} label="skala sama untuk 12 bulan" />
      <p className="text-caption text-ink-muted">
        Grid 0,05°, hanya deteksi di dalam WPP {code} tahun {grid.year}. Skala warna dibuat sama untuk ke-12 bulan sehingga perubahan
        antarbulan dapat dibandingkan.
      </p>
    </div>
  );
}
