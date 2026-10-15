"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, ImageSource, MapMouseEvent } from "maplibre-gl";
import { Pause, Play } from "lucide-react";
import { Banner } from "@/components/ui/Banner";
import { StateView } from "@/components/ui/StateView";
import { INDONESIA_BOUNDS, useBaseMap } from "@/components/viirs/ViirsMaps";
import { cn } from "@/lib/cn";
import { formatLatLon } from "@/lib/format";
import { GROUP_LABEL, MONTH_LONG, MONTH_SHORT, VAR_STYLE, fmtVar, monthLabel, rampColor, scalePos, type OceanGroup } from "@/lib/oseanografi/format";
import type { OceanGrid, OceanVarKey, OceanVarMeta } from "@/lib/oseanografi/types";

/**
 * Peta bulanan variabel oseanografi (grid 0,25°) di atas basemap gelap + batas WPP.
 * Grid digambar sebagai satu gambar raster: tiap baris gambar dipetakan ke lintangnya di proyeksi Mercator agar sel
 * tidak bergeser. Arus & angin diberi panah arah (grid 1°). Nilai pasti tampil di tooltip saat kursor di atas laut.
 */

const SOURCE = "ocean";
const LAYER = "ocean-raster";
const ARROWS = "ocean-arrows";
const CANVAS_W = 880;
const CANVAS_H = 440;

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const invMercY = (y: number) => (Math.atan(Math.sinh(y)) * 180) / Math.PI;

function dense(grid: OceanGrid, frame: string): Float32Array {
  const out = new Float32Array(grid.nx * grid.ny).fill(NaN);
  const vals = grid.frames[frame];
  if (!vals) return out;
  for (let i = 0; i < grid.cells.length; i++) {
    const v = vals[i];
    if (v !== null) out[grid.cells[i]] = v / grid.scale;
  }
  return out;
}

function renderImage(grid: OceanGrid, values: Float32Array, ramp: string[]): string {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(CANVAS_W, CANVAS_H);
  const north = grid.lat0 + grid.ny * grid.res;
  const yTop = mercY(north);
  const yBot = mercY(grid.lat0);
  for (let r = 0; r < CANVAS_H; r++) {
    const lat = invMercY(yTop + ((r + 0.5) / CANVAS_H) * (yBot - yTop));
    const iy = Math.floor((lat - grid.lat0) / grid.res);
    if (iy < 0 || iy >= grid.ny) continue;
    for (let c = 0; c < CANVAS_W; c++) {
      const ix = Math.floor(((c + 0.5) / CANVAS_W) * grid.nx);
      const v = values[iy * grid.nx + ix];
      if (!Number.isFinite(v)) continue;
      const [R, G, B] = rampColor(ramp, scalePos(v, grid.vmin, grid.vmax, grid.log));
      const o = (r * CANVAS_W + c) * 4;
      img.data[o] = R;
      img.data[o + 1] = G;
      img.data[o + 2] = B;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

function corners(grid: OceanGrid): [[number, number], [number, number], [number, number], [number, number]] {
  const w = grid.lon0, e = grid.lon0 + grid.nx * grid.res, s = grid.lat0, n = grid.lat0 + grid.ny * grid.res;
  return [[w, n], [e, n], [e, s], [w, s]];
}

function arrowFeatures(grid: OceanGrid, frame: string) {
  const a = grid.arrows;
  if (!a || !a.frames[frame]) return { type: "FeatureCollection" as const, features: [] };
  const [us, vs] = a.frames[frame];
  const speeds: number[] = [];
  const features = [];
  for (let i = 0; i < a.cells.length; i++) {
    const u = us[i], v = vs[i];
    if (u === null || v === null) continue;
    const uu = u / a.scale, vv = v / a.scale;
    const speed = Math.hypot(uu, vv);
    speeds.push(speed);
    const cell = a.cells[i];
    const lon = a.lon0 + ((cell % a.nx) + 0.5) * a.res;
    const lat = a.lat0 + (Math.floor(cell / a.nx) + 0.5) * a.res;
    features.push({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [lon, lat] },
      properties: { speed, bearing: (Math.atan2(uu, vv) * 180) / Math.PI },
    });
  }
  const max = speeds.reduce((m, s) => (s > m ? s : m), 0) || 1;
  for (const f of features) (f.properties as Record<string, number>).size = 0.5 + 0.5 * Math.min(1, f.properties.speed / max);
  return { type: "FeatureCollection" as const, features };
}

/** Ikon panah putih (SDF) untuk arah arus/angin. */
function arrowIcon(): ImageData {
  const s = 32;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(16, 2);
  ctx.lineTo(25, 14);
  ctx.lineTo(19, 14);
  ctx.lineTo(19, 30);
  ctx.lineTo(13, 30);
  ctx.lineTo(13, 14);
  ctx.lineTo(7, 14);
  ctx.closePath();
  ctx.fill();
  return ctx.getImageData(0, 0, s, s);
}

type Props = { variables: OceanVarMeta[]; initial?: OceanVarKey };

export function OceanMap({ variables, initial = "sst" }: Props) {
  const { node, mapRef, popupRef, ready, error } = useBaseMap(INDONESIA_BOUNDS);
  const [key, setKey] = useState<OceanVarKey>(initial);
  const [frame, setFrame] = useState<string>("8");
  const [playing, setPlaying] = useState(false);
  const [grids, setGrids] = useState<Partial<Record<OceanVarKey, OceanGrid | "error">>>({});
  const meta = variables.find((v) => v.key === key)!;
  const style = VAR_STYLE[key];
  const loaded = grids[key];
  const grid = loaded && loaded !== "error" ? loaded : null;
  const hasLatest = !!grid?.latestMonth;
  const activeFrame = frame === "latest" && !hasLatest ? "8" : frame;
  const values = useMemo(() => (grid ? dense(grid, activeFrame) : null), [grid, activeFrame]);
  const valuesRef = useRef<{ grid: OceanGrid; values: Float32Array } | null>(null);
  useEffect(() => {
    valuesRef.current = grid && values ? { grid, values } : null;
  }, [grid, values]);

  // Unduh grid variabel saat pertama dipilih.
  useEffect(() => {
    if (grids[key]) return;
    let cancelled = false;
    fetch(`/api/oseanografi/grid/${key}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((g: OceanGrid) => !cancelled && setGrids((s) => ({ ...s, [key]: g })))
      .catch(() => !cancelled && setGrids((s) => ({ ...s, [key]: "error" })));
    return () => {
      cancelled = true;
    };
  }, [key, grids]);

  // Animasi 12 bulan.
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setFrame((f) => String(((Number(f) || 0) % 12) + 1)), 1300);
    return () => window.clearInterval(id);
  }, [playing]);

  // Gambar raster + panah.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !grid || !values) return;
    const url = renderImage(grid, values, style.ramp);
    const coords = corners(grid);
    const src = map.getSource(SOURCE) as ImageSource | undefined;
    if (src) src.updateImage({ url, coordinates: coords });
    else {
      map.addSource(SOURCE, { type: "image", url, coordinates: coords });
      const before = map.getLayer("wpp-line") ? "wpp-line" : map.getStyle().layers?.find((l) => l.type === "symbol")?.id;
      map.addLayer({ id: LAYER, type: "raster", source: SOURCE, paint: { "raster-opacity": 0.85, "raster-resampling": "nearest", "raster-fade-duration": 0 } }, before);
    }
    const fc = arrowFeatures(grid, activeFrame);
    const asrc = map.getSource(ARROWS) as GeoJSONSource | undefined;
    if (asrc) asrc.setData(fc);
    else {
      if (!map.hasImage("ocean-arrow")) map.addImage("ocean-arrow", arrowIcon(), { sdf: true });
      map.addSource(ARROWS, { type: "geojson", data: fc });
      map.addLayer({
        id: ARROWS,
        type: "symbol",
        source: ARROWS,
        layout: {
          "icon-image": "ocean-arrow",
          "icon-rotate": ["get", "bearing"],
          "icon-rotation-alignment": "map",
          // Ekspresi zoom harus berada di tingkat teratas interpolate (aturan MapLibre).
          "icon-size": ["interpolate", ["linear"], ["zoom"], 3, ["*", 0.42, ["get", "size"]], 7, ["*", 0.9, ["get", "size"]]],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: { "icon-color": "#ffffff", "icon-opacity": 0.85 },
      });
    }
  }, [ready, grid, values, activeFrame, style.ramp, mapRef]);

  // Tooltip nilai sel.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const onMove = (e: MapMouseEvent) => {
      const cur = valuesRef.current;
      if (!cur) return;
      const { lng, lat } = e.lngLat;
      const ix = Math.floor((lng - cur.grid.lon0) / cur.grid.res);
      const iy = Math.floor((lat - cur.grid.lat0) / cur.grid.res);
      const v = ix >= 0 && iy >= 0 && ix < cur.grid.nx && iy < cur.grid.ny ? cur.values[iy * cur.grid.nx + ix] : NaN;
      if (!Number.isFinite(v)) {
        popupRef.current?.remove();
        map.getCanvas().style.cursor = "";
        return;
      }
      map.getCanvas().style.cursor = "crosshair";
      const k = cur.grid.key;
      const unit = variables.find((x) => x.key === k)?.unit ?? "";
      const clat = cur.grid.lat0 + (iy + 0.5) * cur.grid.res;
      const clon = cur.grid.lon0 + (ix + 0.5) * cur.grid.res;
      popupRef.current
        ?.setLngLat([clon, clat])
        .setHTML(`<strong>${fmtVar(k, v)} ${unit}</strong><br/><span>${VAR_STYLE[k].short} · sel 0,25° · ${formatLatLon(clat, clon)}</span>`)
        .addTo(map);
    };
    const onOut = () => popupRef.current?.remove();
    map.on("mousemove", onMove);
    map.on("mouseout", onOut);
    return () => {
      map.off("mousemove", onMove);
      map.off("mouseout", onOut);
    };
  }, [ready, mapRef, popupRef, variables]);

  const groups = (Object.keys(GROUP_LABEL) as OceanGroup[]).map((g) => ({ g, items: variables.filter((v) => VAR_STYLE[v.key].group === g) }));
  const frameLabel =
    activeFrame === "latest" && grid?.latestMonth
      ? `${monthLabel(grid.latestMonth)} (bulan terbaru)`
      : meta.kind === "series"
        ? `${MONTH_LONG[Number(activeFrame) - 1]} · rata-rata ${meta.period.climatology?.join("–")}`
        : meta.kind === "year"
          ? `${MONTH_LONG[Number(activeFrame) - 1]} ${meta.period.year}`
          : `${MONTH_LONG[Number(activeFrame) - 1]} · klimatologi model`;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3">
        {groups.map(({ g, items }) =>
          items.length ? (
            <div key={g} className="flex flex-wrap items-center gap-2">
              <span className="w-full text-caption font-medium text-ink-muted sm:w-36">{GROUP_LABEL[g]}</span>
              {items.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  aria-pressed={v.key === key}
                  onClick={() => setKey(v.key)}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-full border px-3 transition-colors duration-150",
                    v.key === key ? "border-primary bg-primary-soft font-semibold text-primary" : "border-border-control bg-surface text-ink hover:bg-surface-subtle",
                  )}
                >
                  <span aria-hidden className="h-2.5 w-4 rounded-sm" style={{ background: `linear-gradient(90deg, ${VAR_STYLE[v.key].ramp[1]}, ${VAR_STYLE[v.key].ramp[VAR_STYLE[v.key].ramp.length - 2]})` }} />
                  {v.label}
                </button>
              ))}
            </div>
          ) : null,
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (frame === "latest") setFrame("1");
            setPlaying((p) => !p);
          }}
          aria-pressed={playing}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-border-control bg-surface px-3 text-ink hover:bg-surface-subtle"
        >
          {playing ? <Pause aria-hidden className="h-4 w-4" /> : <Play aria-hidden className="h-4 w-4" />}
          {playing ? "Jeda" : "Putar 12 bulan"}
        </button>
        <div role="group" aria-label="Pilih bulan" className="flex flex-wrap gap-1">
          {MONTH_SHORT.map((m, i) => (
            <button
              key={m}
              type="button"
              aria-pressed={activeFrame === String(i + 1)}
              aria-label={MONTH_LONG[i]}
              onClick={() => {
                setPlaying(false);
                setFrame(String(i + 1));
              }}
              className={cn(
                "inline-flex h-9 min-w-10 items-center justify-center rounded-input px-2 text-caption outline-none focus-visible:ring-2 focus-visible:ring-primary",
                activeFrame === String(i + 1) ? "bg-primary font-semibold text-inverse" : "text-ink hover:bg-surface-subtle",
              )}
            >
              {m}
            </button>
          ))}
          {hasLatest ? (
            <button
              type="button"
              aria-pressed={activeFrame === "latest"}
              onClick={() => {
                setPlaying(false);
                setFrame("latest");
              }}
              className={cn(
                "inline-flex h-9 items-center rounded-input px-3 text-caption",
                activeFrame === "latest" ? "bg-primary font-semibold text-inverse" : "border border-border-control text-ink hover:bg-surface-subtle",
              )}
            >
              Terbaru · {monthLabel(grid!.latestMonth!)}
            </button>
          ) : null}
        </div>
      </div>

      <p className="font-semibold text-ink" role="status" aria-live="polite">
        {meta.label} · {frameLabel}
      </p>
      {error ? <Banner tone="warning" title={error} /> : null}
      {loaded === "error" ? (
        <StateView state="error" title="Grid variabel ini tidak dapat dimuat" className="min-h-[300px]" />
      ) : (
        <div className="relative h-[440px] min-w-0 overflow-hidden rounded-card border border-border sm:h-[540px]">
          <div ref={node} className="h-full w-full" role="region" aria-label={`Peta ${meta.label}, ${frameLabel}`} />
          {!ready || !grid ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#121416]/60 text-caption text-white" role="status">
              Memuat peta…
            </div>
          ) : null}
        </div>
      )}
      {grid ? <Legend grid={grid} meta={meta} /> : null}
      <div className="grid gap-2 rounded-button border border-border bg-white/60 p-3 text-caption sm:grid-cols-2">
        <p>
          <span className="font-semibold text-ink">Apa ini? </span>
          <span className="text-ink">{style.what}</span>
        </p>
        <p>
          <span className="font-semibold text-ink">Kenapa penting? </span>
          <span className="text-ink">{style.why}</span>
        </p>
      </div>
    </div>
  );
}

function Legend({ grid, meta }: { grid: OceanGrid; meta: OceanVarMeta }) {
  const ramp = VAR_STYLE[meta.key].ramp;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) =>
    grid.log ? 10 ** (Math.log10(grid.vmin) + t * (Math.log10(grid.vmax) - Math.log10(grid.vmin))) : grid.vmin + t * (grid.vmax - grid.vmin),
  );
  return (
    <div className="flex flex-col gap-1 text-caption text-ink-muted">
      <div aria-hidden className="h-3 w-full max-w-md rounded-[3px]" style={{ background: `linear-gradient(90deg, ${ramp.join(", ")})` }} />
      <div className="flex w-full max-w-md justify-between tabular">
        {ticks.map((t, i) => (
          <span key={i}>{fmtVar(meta.key, t, grid.log ? 2 : Math.min(VAR_STYLE[meta.key].digits, 2))}</span>
        ))}
      </div>
      <p>
        {meta.unit ? `Satuan ${meta.unit}. ` : ""}
        Skala warna sama untuk semua bulan{grid.log ? " dan memakai skala logaritmik" : ""}; nilai di luar rentang ditampilkan dengan warna ujung.
        {meta.arrows ? " Panah: arah aliran, makin besar makin kencang." : ""} Garis abu-abu: batas WPP.
      </p>
    </div>
  );
}
