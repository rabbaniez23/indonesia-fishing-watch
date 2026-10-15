"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import type { GeoJSONSource, ImageSource, Map as MapLibreMap, MapMouseEvent, Popup } from "maplibre-gl";
import metaJson from "@/data/oseanografi/meta.json";
import { arrowFeatures, arrowIcon, corners, dense, renderImage } from "@/components/oseanografi/raster";
import { formatLatLon } from "@/lib/format";
import { GROUP_LABEL, MONTH_LONG, VAR_STYLE, fmtVar, type OceanGroup } from "@/lib/oseanografi/format";
import { dominantMonth, oceanFrame } from "@/lib/oseanografi/month";
import type { OceanGrid, OceanMeta, OceanVarKey, OceanVarMeta } from "@/lib/oseanografi/types";

/**
 * Lapisan laut (Copernicus Marine) di menu Peta: satu variabel oseanografi sebagai raster 0,25° di bawah sel GFW dan
 * heatmap VIIRS, sehingga klik sel, detail, dan simpan temuan tetap milik layer GFW. Bulan mengikuti filter periode:
 * dipakai bulan kalender yang paling banyak tercakup periode; data bulan itu sendiri dipakai bila tersedia
 * (bulan terbaru), selain itu rata-rata bulan tersebut.
 */

const meta = metaJson as OceanMeta;
export const OCEAN_VARIABLES: OceanVarMeta[] = meta.variables;

const SOURCE = "peta-laut";
const LAYER = "peta-laut-raster";
const ARROWS = "peta-laut-arrows";
const ICON = "peta-laut-arrow";

type Theme = "dark" | "light";

export function parseOceanParam(value: string | null): OceanVarKey | null {
  return OCEAN_VARIABLES.find((v) => v.key === value)?.key ?? null;
}

/** Simpan pilihan di URL (?laut=sst) tanpa render ulang server. */
export function syncOceanToUrl(key: OceanVarKey | null) {
  const url = new URL(window.location.href);
  if (key) url.searchParams.set("laut", key);
  else url.searchParams.delete("laut");
  window.history.replaceState(null, "", url);
}

function removeOverlay(map: MapLibreMap) {
  for (const id of [ARROWS, LAYER]) if (map.getLayer(id)) map.removeLayer(id);
  for (const id of [ARROWS, SOURCE]) if (map.getSource(id)) map.removeSource(id);
}

type OverlayArgs = {
  mapRef: RefObject<MapLibreMap | null>;
  popupRef: RefObject<Popup | null>;
  mapReady: boolean;
  theme: Theme;
  /** null = lapisan laut mati. */
  selection: OceanVarKey | null;
  filter: { from: string; to: string };
  /** Kepekatan raster (0–1). */
  opacity: number;
};

/** Di basemap gelap kecerahan raster dibatasi agar titik GFW (hijau-kuning menyala) tetap paling menonjol. */
const BRIGHTNESS_MAX: Record<Theme, number> = { dark: 0.72, light: 1 };

export function useOceanOverlay({ mapRef, popupRef, mapReady, theme, selection, filter, opacity }: OverlayArgs) {
  const [grids, setGrids] = useState<Partial<Record<OceanVarKey, OceanGrid | "error">>>({});
  const loaded = selection ? grids[selection] : undefined;
  const grid = loaded && loaded !== "error" ? loaded : null;
  const varMeta = selection ? OCEAN_VARIABLES.find((v) => v.key === selection) ?? null : null;
  const ym = dominantMonth(filter.from, filter.to);
  const latestMonth = grid?.latestMonth ?? null;
  const frameInfo = varMeta ? oceanFrame(varMeta, latestMonth, ym) : null;
  const frameKey = frameInfo ? frameInfo.frame : null;
  const frameLabel = frameInfo ? frameInfo.label : "";
  const values = useMemo(() => (grid && varMeta ? dense(grid, oceanFrame(varMeta, grid.latestMonth, ym).frame) : null), [grid, varMeta, ym]);
  const hoverRef = useRef<{ grid: OceanGrid; values: Float32Array; label: string } | null>(null);
  useEffect(() => {
    hoverRef.current = grid && values ? { grid, values, label: frameLabel } : null;
  }, [grid, values, frameLabel]);

  // Grid tiap variabel diunduh sekali, saat pertama dipilih.
  useEffect(() => {
    if (!selection || grids[selection]) return;
    let cancelled = false;
    fetch(`/api/oseanografi/grid/${selection}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((g: OceanGrid) => !cancelled && setGrids((s) => ({ ...s, [selection]: g })))
      .catch(() => !cancelled && setGrids((s) => ({ ...s, [selection]: "error" })));
    return () => {
      cancelled = true;
    };
  }, [selection, grids]);

  // Raster + panah. Peta dibuat ulang saat ganti gaya → mapReady berubah → lapisan dipasang lagi.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    if (!grid || !values || !selection || !frameKey) {
      removeOverlay(map);
      return;
    }
    const url = renderImage(grid, values, VAR_STYLE[selection].ramp);
    const coords = corners(grid);
    // Paling bawah di antara layer data (di bawah area wilayah, heatmap VIIRS, dan sel GFW).
    const before = map.getLayer("region-fill") ? "region-fill" : undefined;
    const src = map.getSource(SOURCE) as ImageSource | undefined;
    if (src) src.updateImage({ url, coordinates: coords });
    else {
      map.addSource(SOURCE, { type: "image", url, coordinates: coords });
      map.addLayer(
        {
          id: LAYER,
          type: "raster",
          source: SOURCE,
          paint: { "raster-opacity": opacity, "raster-brightness-max": BRIGHTNESS_MAX[theme], "raster-resampling": "nearest", "raster-fade-duration": 0 },
        },
        before,
      );
    }
    const fc = arrowFeatures(grid, frameKey);
    const asrc = map.getSource(ARROWS) as GeoJSONSource | undefined;
    if (asrc) asrc.setData(fc);
    else {
      if (!map.hasImage(ICON)) map.addImage(ICON, arrowIcon(), { sdf: true });
      map.addSource(ARROWS, { type: "geojson", data: fc });
      map.addLayer(
        {
          id: ARROWS,
          type: "symbol",
          source: ARROWS,
          layout: {
            "icon-image": ICON,
            "icon-rotate": ["get", "bearing"],
            "icon-rotation-alignment": "map",
            // Ekspresi zoom harus berada di tingkat teratas interpolate (aturan MapLibre).
            "icon-size": ["interpolate", ["linear"], ["zoom"], 3, ["*", 0.42, ["get", "size"]], 7, ["*", 0.9, ["get", "size"]]],
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          },
          paint: { "icon-color": theme === "dark" ? "#ffffff" : "#1f2937", "icon-opacity": Math.min(0.8, opacity + 0.15) },
        },
        before,
      );
    }
    // opacity diatur effect di bawah; tidak perlu menggambar ulang raster saat slider digeser.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, grid, values, selection, frameKey, theme, mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    if (map.getLayer(LAYER)) map.setPaintProperty(LAYER, "raster-opacity", opacity);
    if (map.getLayer(ARROWS)) map.setPaintProperty(ARROWS, "icon-opacity", Math.min(0.8, opacity + 0.15));
  }, [mapReady, opacity, mapRef, grid]);

  // Tooltip nilai laut hanya bila kursor tidak di atas sel GFW atau titik VIIRS (keduanya diutamakan).
  const enabled = selection !== null;
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !enabled) return;
    let showing = false;
    const hide = () => {
      if (!showing) return;
      showing = false;
      popupRef.current?.remove();
    };
    const onMove = (e: MapMouseEvent) => {
      const busy = ["cells-fill", "viirs-hit"].filter((id) => map.getLayer(id));
      if (busy.length && map.queryRenderedFeatures(e.point, { layers: busy }).length > 0) {
        showing = false;
        return;
      }
      const cur = hoverRef.current;
      if (!cur) return hide();
      const { grid: g, values: vals, label } = cur;
      const ix = Math.floor((e.lngLat.lng - g.lon0) / g.res);
      const iy = Math.floor((e.lngLat.lat - g.lat0) / g.res);
      const v = ix >= 0 && iy >= 0 && ix < g.nx && iy < g.ny ? vals[iy * g.nx + ix] : NaN;
      if (!Number.isFinite(v)) return hide();
      const unit = OCEAN_VARIABLES.find((x) => x.key === g.key)?.unit ?? "";
      const clat = g.lat0 + (iy + 0.5) * g.res;
      const clon = g.lon0 + (ix + 0.5) * g.res;
      showing = true;
      popupRef.current
        ?.setLngLat([clon, clat])
        .setHTML(`<strong>${VAR_STYLE[g.key].short}: ${fmtVar(g.key, v)} ${unit}</strong><br/><span>${label} · sel 0,25° · ${formatLatLon(clat, clon)}</span>`)
        .addTo(map);
    };
    map.on("mousemove", onMove);
    map.on("mouseout", hide);
    return () => {
      map.off("mousemove", onMove);
      map.off("mouseout", hide);
    };
  }, [mapReady, enabled, mapRef, popupRef]);

  const status: "off" | "loading" | "ready" | "error" = !enabled ? "off" : loaded === "error" ? "error" : grid ? "ready" : "loading";
  return { status, grid, meta: varMeta, frameLabel, month: MONTH_LONG[Number(ym.slice(5, 7)) - 1] };
}

/** Kontrol di panel Peta: pilihan variabel laut, legenda, dan catatan bulan. */
export function OceanLayerControl({
  selection,
  onChange,
  overlay,
  opacity,
  onOpacityChange,
}: {
  selection: OceanVarKey | null;
  onChange: (key: OceanVarKey | null) => void;
  overlay: ReturnType<typeof useOceanOverlay>;
  opacity: number;
  onOpacityChange: (v: number) => void;
}) {
  const groups = (Object.keys(GROUP_LABEL) as OceanGroup[]).map((g) => ({ g, items: OCEAN_VARIABLES.filter((v) => VAR_STYLE[v.key].group === g) }));
  const { status, grid, meta: v, frameLabel } = overlay;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="lapisan-laut" className="font-medium">
        Lapisan laut (Copernicus Marine)
      </label>
      <select
        id="lapisan-laut"
        value={selection ?? ""}
        onChange={(e) => onChange(parseOceanParam(e.target.value))}
        className="h-11 rounded-input border border-border-control bg-surface px-3 text-ink"
      >
        <option value="">Tidak ada</option>
        {groups.map(({ g, items }) =>
          items.length ? (
            <optgroup key={g} label={GROUP_LABEL[g]}>
              {items.map((x) => (
                <option key={x.key} value={x.key}>
                  {x.label}
                </option>
              ))}
            </optgroup>
          ) : null,
        )}
      </select>
      {selection && v ? (
        <div className="flex flex-col gap-2 pl-1 text-caption text-ink-muted">
          {status === "loading" ? <p role="status">Memuat data laut…</p> : null}
          {status === "error" ? (
            <p className="text-error" role="status">
              Data laut gagal dimuat.
            </p>
          ) : null}
          {status === "ready" && grid ? (
            <>
              <p className="font-medium text-ink" role="status" aria-live="polite">
                {v.label} · {frameLabel}
              </p>
              <OceanLegend grid={grid} meta={v} />
              <label htmlFor="opacity-laut" className="mt-1 font-medium text-ink">
                Kepekatan lapisan laut: {Math.round(opacity * 100)}%
              </label>
              <input
                id="opacity-laut"
                type="range"
                min={0.2}
                max={1}
                step={0.05}
                value={opacity}
                onChange={(e) => onOpacityChange(Number(e.target.value))}
                className="h-11 accent-[var(--color-primary)]"
              />
            </>
          ) : null}
          <p>
            Bulan <strong className="font-medium text-ink">mengikuti filter periode</strong> (bulan yang paling banyak tercakup). Digambar di bawah
            titik kapal; nilai muncul saat kursor di laut tanpa titik.{" "}
            <Link href={`/oseanografi?var=${selection}`} className="font-medium text-primary underline underline-offset-2">
              Pelajari di menu Oseanografi
            </Link>
          </p>
        </div>
      ) : null}
    </div>
  );
}

function OceanLegend({ grid, meta: v }: { grid: OceanGrid; meta: OceanVarMeta }) {
  const ramp = VAR_STYLE[v.key].ramp;
  const ticks = [0, 0.5, 1].map((t) =>
    grid.log ? 10 ** (Math.log10(grid.vmin) + t * (Math.log10(grid.vmax) - Math.log10(grid.vmin))) : grid.vmin + t * (grid.vmax - grid.vmin),
  );
  return (
    <div className="flex flex-col gap-1">
      <span aria-hidden className="h-2.5 w-full rounded-[3px]" style={{ background: `linear-gradient(90deg, ${ramp.join(", ")})` }} />
      <span className="flex justify-between tabular">
        {ticks.map((t, i) => (
          <span key={i}>{fmtVar(v.key, t, grid.log ? 2 : Math.min(VAR_STYLE[v.key].digits, 2))}</span>
        ))}
      </span>
      <span>
        {v.unit ? `Satuan ${v.unit}` : ""}
        {grid.log ? " · skala logaritmik" : ""}
        {v.arrows ? " · panah = arah aliran, makin besar makin kencang" : ""}
      </span>
    </div>
  );
}
