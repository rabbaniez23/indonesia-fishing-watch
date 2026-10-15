"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import Link from "next/link";
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent, Popup } from "maplibre-gl";
import metaJson from "@/data/viirs/meta.json";
import { cn } from "@/lib/cn";
import { formatCount, formatLatLon } from "@/lib/format";
import { CLASS_LABEL, CLASS_RULE, monthLabel } from "@/lib/viirs/format";
import { densityFeatures, type DensityKey } from "@/lib/viirs/grid";
import type { ViirsDensity } from "@/lib/viirs/types";

/**
 * Lapisan tambahan VIIRS di menu Peta: heatmap kepadatan deteksi kapal malam (akumulasi seluruh periode data VIIRS,
 * tidak mengikuti filter periode GFW). Magenta dipilih agar tidak tertukar dengan ramp GFW (hijau-lime, toska, oranye SAR).
 * Digambar di bawah sel GFW sehingga klik sel, detail, dan simpan temuan tetap milik layer GFW.
 */

const meta = metaJson as { dateRange: { start: string; end: string } };
export const VIIRS_PERIOD = `${monthLabel(meta.dateRange.start.slice(0, 7))} – ${monthLabel(meta.dateRange.end.slice(0, 7))}`;

type Theme = "dark" | "light";
/** Ramp satu hue (magenta): gelap → terang di basemap gelap, terang → gelap di basemap terang. */
export const VIIRS_RAMP: Record<Theme, string[]> = {
  dark: ["#5B1A5E", "#86207F", "#B02A9C", "#D946B8", "#F07FD3", "#FBD3F1"],
  light: ["#F5C6EC", "#E58AD6", "#C94FB8", "#A32796", "#7A1670", "#55104F"],
};

export const VIIRS_OPTIONS: Array<{ key: DensityKey; label: string }> = [
  { key: "all", label: "Semua" },
  { key: "low", label: `${CLASS_LABEL.low} ${CLASS_RULE.low}` },
  { key: "medium", label: `${CLASS_LABEL.medium} ${CLASS_RULE.medium}` },
  { key: "high", label: `${CLASS_LABEL.high} ${CLASS_RULE.high}` },
];
const URL_VALUE: Record<DensityKey, string> = { all: "semua", low: "rendah", medium: "sedang", high: "tinggi" };

export function parseViirsParam(value: string | null): DensityKey | null {
  const hit = (Object.keys(URL_VALUE) as DensityKey[]).find((k) => URL_VALUE[k] === value);
  return hit ?? null;
}

/** Simpan pilihan di URL (?viirs=tinggi) tanpa render ulang server. */
export function syncViirsToUrl(key: DensityKey | null) {
  const url = new URL(window.location.href);
  if (key) url.searchParams.set("viirs", URL_VALUE[key]);
  else url.searchParams.delete("viirs");
  window.history.replaceState(null, "", url);
}

const SOURCE = "viirs";
const HEAT = "viirs-heat";
const HIT = "viirs-hit";

function heatColor(theme: Theme): unknown {
  const r = VIIRS_RAMP[theme];
  return ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)", 0.12, r[0], 0.3, r[1], 0.5, r[2], 0.7, r[3], 0.88, r[4], 1, r[5]];
}

function removeOverlay(map: MapLibreMap) {
  if (map.getLayer(HIT)) map.removeLayer(HIT);
  if (map.getLayer(HEAT)) map.removeLayer(HEAT);
  if (map.getSource(SOURCE)) map.removeSource(SOURCE);
}

type OverlayArgs = {
  mapRef: RefObject<MapLibreMap | null>;
  popupRef: RefObject<Popup | null>;
  mapReady: boolean;
  theme: Theme;
  /** null = lapisan VIIRS mati. */
  selection: DensityKey | null;
};

export function useViirsOverlay({ mapRef, popupRef, mapReady, theme, selection }: OverlayArgs) {
  const enabled = selection !== null;
  const [fetched, setFetched] = useState<{ data: ViirsDensity | null; error: boolean } | null>(null);

  // Grid diambil sekali, hanya setelah lapisan pertama kali dinyalakan.
  const needData = enabled && fetched === null;
  useEffect(() => {
    if (!needData) return;
    let cancelled = false;
    fetch("/api/viirs/density")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: ViirsDensity) => !cancelled && setFetched({ data, error: false }))
      .catch(() => !cancelled && setFetched({ data: null, error: true }));
    return () => {
      cancelled = true;
    };
  }, [needData]);
  const data = fetched?.data ?? null;

  const built = useMemo(() => (data && selection ? densityFeatures(data, selection) : null), [data, selection]);

  // Tambah/perbarui/hapus heatmap. Peta dibuat ulang saat ganti gaya → mapReady berubah → lapisan dipasang lagi.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    if (!built) {
      removeOverlay(map);
      return;
    }
    const k = built.sparse ? 3 : 1;
    const intensity = ["interpolate", ["linear"], ["zoom"], 3, 0.3 * k, 6, 0.7 * k, 9, 1.4 * k];
    const src = map.getSource(SOURCE) as GeoJSONSource | undefined;
    if (src) {
      src.setData(built.fc);
      map.setPaintProperty(HEAT, "heatmap-intensity", intensity as never);
      map.setPaintProperty(HEAT, "heatmap-color", heatColor(theme) as never);
      return;
    }
    map.addSource(SOURCE, { type: "geojson", data: built.fc });
    // Di bawah sel GFW (cells-fill paling bawah di antara layer sel) agar titik GFW tetap terlihat & dapat diklik.
    const before = map.getLayer("cells-fill") ? "cells-fill" : undefined;
    map.addLayer(
      {
        id: HEAT,
        type: "heatmap",
        source: SOURCE,
        paint: {
          "heatmap-weight": ["get", "w"],
          "heatmap-intensity": intensity as never,
          // ≈ 1,3 × jarak antarsel 0,1° (0,1422 × 2^zoom px) agar kernel menyatu dan tidak tampak berbintik saat diperbesar.
          "heatmap-radius": ["interpolate", ["exponential", 2], ["zoom"], 3, 2.5, 6, 12, 10, 190],
          "heatmap-color": heatColor(theme) as never,
          "heatmap-opacity": 0.85,
        },
      },
      before,
    );
    map.addLayer(
      { id: HIT, type: "circle", source: SOURCE, paint: { "circle-radius": ["interpolate", ["exponential", 2], ["zoom"], 3, 3, 6, 6, 10, 70], "circle-opacity": 0 } },
      before,
    );
  }, [mapReady, built, theme, mapRef]);

  // Tooltip VIIRS hanya bila kursor tidak berada di atas sel GFW (tooltip GFW diutamakan).
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !enabled) return;
    let showing = false;
    const onMove = (e: MapLayerMouseEvent) => {
      if (map.queryRenderedFeatures(e.point, { layers: ["cells-fill"] }).length > 0) return;
      const p = e.features?.[0]?.properties as Record<string, number> | undefined;
      if (!p) return;
      showing = true;
      popupRef.current
        ?.setLngLat([p.lon, p.lat])
        .setHTML(
          `<strong>VIIRS: ${formatCount(p.all)} deteksi kapal malam</strong><br/><span>${VIIRS_PERIOD} · sel 0,1° · ${formatLatLon(p.lat, p.lon)}</span><br/>` +
            `<span>Rendah ${formatCount(p.low)} · Sedang ${formatCount(p.medium)} · Tinggi ${formatCount(p.high)}</span>`,
        )
        .addTo(map);
    };
    const onLeave = () => {
      if (!showing) return;
      showing = false;
      popupRef.current?.remove();
    };
    map.on("mousemove", HIT, onMove);
    map.on("mouseleave", HIT, onLeave);
    return () => {
      map.off("mousemove", HIT, onMove);
      map.off("mouseleave", HIT, onLeave);
    };
  }, [mapReady, enabled, mapRef, popupRef]);

  const status: "off" | "loading" | "ready" | "error" = !enabled ? "off" : fetched?.error ? "error" : built ? "ready" : "loading";
  return { status, max: built?.max ?? 0 };
}

/** Kontrol di panel Peta: ceklis, pilihan kelas, legenda, dan catatan periode. */
export function ViirsLayerControl({
  selection,
  onChange,
  status,
  max,
  theme,
}: {
  selection: DensityKey | null;
  onChange: (key: DensityKey | null) => void;
  status: "off" | "loading" | "ready" | "error";
  max: number;
  theme: Theme;
}) {
  const ramp = VIIRS_RAMP[theme];
  const enabled = selection !== null;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-card-title font-semibold">Lapisan tambahan</legend>
      <label
        className={cn(
          "flex min-h-11 cursor-pointer items-center gap-3 rounded-button border px-3 py-2",
          enabled ? "border-primary bg-primary-soft" : "border-border hover:bg-surface-subtle",
        )}
      >
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked ? "all" : null)}
          className="size-4 accent-[var(--color-primary)]"
        />
        <span aria-hidden className="h-3 w-6 shrink-0 rounded-sm" style={{ background: `linear-gradient(90deg, ${ramp[0]}, ${ramp[ramp.length - 1]})` }} />
        <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
          <span className="font-medium">VIIRS · kapal malam</span>
          <span className="text-caption text-ink-muted">Kepadatan deteksi, {VIIRS_PERIOD}</span>
        </span>
      </label>
      {enabled ? (
        <div className="flex flex-col gap-2 pl-1">
          <div role="group" aria-label="Kelas radiansi VIIRS" className="flex flex-wrap gap-1.5">
            {VIIRS_OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                aria-pressed={o.key === selection}
                onClick={() => onChange(o.key)}
                className={cn(
                  "inline-flex h-8 items-center rounded-full border px-2.5 text-caption transition-colors duration-150",
                  o.key === selection ? "border-primary bg-primary-soft font-semibold text-primary" : "border-border-control bg-surface text-ink hover:bg-surface-subtle",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          {status === "loading" ? <p className="text-caption text-ink-muted" role="status">Memuat data VIIRS…</p> : null}
          {status === "error" ? (
            <p className="text-caption text-error" role="status">
              Data VIIRS gagal dimuat.
            </p>
          ) : null}
          {status === "ready" ? (
            <div className="flex flex-col gap-1 text-caption text-ink-muted">
              <span className="flex items-center gap-2">
                <span>Jarang</span>
                <span aria-hidden className="flex h-2.5 flex-1 overflow-hidden rounded-[3px]">
                  {ramp.map((c) => (
                    <span key={c} className="h-full flex-1" style={{ background: c }} />
                  ))}
                </span>
                <span>Padat</span>
              </span>
              <span className="tabular">Maks. {formatCount(max)} deteksi per sel 0,1°</span>
            </div>
          ) : null}
          <p className="text-caption text-ink-muted">
            Akumulasi seluruh data VIIRS di 11 WPP; <strong className="font-medium text-ink">tidak mengikuti filter periode</strong>. Lampu yang
            terdeteksi satelit, bukan identitas kapal.{" "}
            <Link href="/viirs?tab=peta" className="font-medium text-primary underline underline-offset-2">
              Analisis VIIRS
            </Link>
          </p>
        </div>
      ) : null}
    </fieldset>
  );
}
