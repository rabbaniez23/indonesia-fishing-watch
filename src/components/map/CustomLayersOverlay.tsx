"use client";

import { useEffect, useState, type RefObject } from "react";
import type { Map as MapLibreMap, MapLayerMouseEvent, Popup } from "maplibre-gl";
import { CircleDot, Layers, Pentagon, Spline } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CustomMapLayer } from "@/lib/cms/types";

type Theme = "dark" | "light";

export type CustomLayersOverlayArgs = {
  mapRef: RefObject<MapLibreMap | null>;
  popupRef: RefObject<Popup | null>;
  mapReady: boolean;
  theme: Theme;
};

/** Teks dari file unggahan wajib di-escape sebelum masuk popup HTML. */
function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function useCustomLayersOverlay({ mapRef, popupRef, mapReady }: CustomLayersOverlayArgs) {
  const [availableLayers, setAvailableLayers] = useState<CustomMapLayer[]>([]);
  const [selectedLayerIds, setSelectedLayerIds] = useState<Set<string>>(new Set());

  // Ambil daftar layer aktif dari server
  useEffect(() => {
    let canceled = false;
    fetch("/api/cms/layers?active=1", { credentials: "same-origin" })
      .then((res) => res.json())
      .then((json) => {
        if (!canceled && json.ok && Array.isArray(json.data)) {
          setAvailableLayers(json.data);
          // Default: aktifkan semua layer yang ditandai isVisible oleh peneliti
          const activeIds = new Set<string>(json.data.map((l: CustomMapLayer) => l.id));
          setSelectedLayerIds(activeIds);
        }
      })
      .catch(() => {
        // abaikan jika gagal fetch
      });
    return () => {
      canceled = true;
    };
  }, []);

  // Sinkronisasi layer ke canvas MapLibre
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Bersihkan layer yang tidak lagi dipilih
    availableLayers.forEach((layer) => {
      const sourceId = `custom-src-${layer.id}`;
      const fillId = `custom-fill-${layer.id}`;
      const lineId = `custom-line-${layer.id}`;
      const pointId = `custom-point-${layer.id}`;

      if (!selectedLayerIds.has(layer.id)) {
        if (map.getLayer(fillId)) map.removeLayer(fillId);
        if (map.getLayer(lineId)) map.removeLayer(lineId);
        if (map.getLayer(pointId)) map.removeLayer(pointId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      }
    });

    // Area & garis di bawah titik kapal GFW (seperti lapisan VIIRS/laut); titik kustom di atasnya.
    const below = map.getLayer("cells-fill") ? "cells-fill" : undefined;

    // Pasang layer yang dipilih
    availableLayers.forEach((layer) => {
      if (!selectedLayerIds.has(layer.id)) return;

      const sourceId = `custom-src-${layer.id}`;
      const fillId = `custom-fill-${layer.id}`;
      const lineId = `custom-line-${layer.id}`;
      const pointId = `custom-point-${layer.id}`;

      // Tambahkan source jika belum ada
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: "geojson",
          data: `/api/cms/layers/${layer.id}/geojson`,
        });
      }

      // Tambahkan layer visual sesuai tipe geometri
      if (layer.layerType === "polygon") {
        if (!map.getLayer(fillId)) {
          map.addLayer({
            id: fillId,
            type: "fill",
            source: sourceId,
            paint: {
              "fill-color": layer.color,
              "fill-opacity": layer.opacity * 0.5,
            },
          }, below);
        }
        if (!map.getLayer(lineId)) {
          map.addLayer({
            id: lineId,
            type: "line",
            source: sourceId,
            paint: {
              "line-color": layer.color,
              "line-width": 2,
              "line-opacity": layer.opacity,
            },
          }, below);
        }
      } else if (layer.layerType === "line") {
        if (!map.getLayer(lineId)) {
          map.addLayer({
            id: lineId,
            type: "line",
            source: sourceId,
            paint: {
              "line-color": layer.color,
              "line-width": 2.5,
              "line-opacity": layer.opacity,
            },
          }, below);
        }
      } else if (layer.layerType === "point") {
        if (!map.getLayer(pointId)) {
          map.addLayer({
            id: pointId,
            type: "circle",
            source: sourceId,
            paint: {
              "circle-color": layer.color,
              "circle-radius": 5.5,
              "circle-opacity": layer.opacity,
              "circle-stroke-color": "#FFFFFF",
              "circle-stroke-width": 1.5,
            },
          });
        }
      }
    });

    // Cleanup saat unmount
    return () => {
      availableLayers.forEach((layer) => {
        const sourceId = `custom-src-${layer.id}`;
        const fillId = `custom-fill-${layer.id}`;
        const lineId = `custom-line-${layer.id}`;
        const pointId = `custom-point-${layer.id}`;
        if (map.getLayer(fillId)) map.removeLayer(fillId);
        if (map.getLayer(lineId)) map.removeLayer(lineId);
        if (map.getLayer(pointId)) map.removeLayer(pointId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      });
    };
  }, [availableLayers, selectedLayerIds, mapReady, mapRef]);

  // Tooltip properti fitur (maks. 6 kolom) saat kursor di atas lapisan kustom; tooltip sel GFW tetap diutamakan.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const shown = availableLayers.filter((l) => selectedLayerIds.has(l.id));
    const ids = shown.flatMap((l) => [`custom-fill-${l.id}`, `custom-line-${l.id}`, `custom-point-${l.id}`]).filter((id) => map.getLayer(id));
    if (!ids.length) return;
    let showing = false;
    const onMove = (e: MapLayerMouseEvent) => {
      if (map.getLayer("cells-fill") && map.queryRenderedFeatures(e.point, { layers: ["cells-fill"] }).length > 0) return;
      const f = e.features?.[0];
      if (!f) return;
      const layer = shown.find((l) => f.layer.id.endsWith(l.id));
      const rows = Object.entries(f.properties ?? {})
        .slice(0, 6)
        .map(([k, v]) => `<span>${escapeHtml(k)}: ${escapeHtml(v)}</span>`)
        .join("<br/>");
      showing = true;
      popupRef.current
        ?.setLngLat(e.lngLat)
        .setHTML(`<strong>${escapeHtml(layer?.name ?? "Lapisan kustom")}</strong>${rows ? `<br/>${rows}` : ""}`)
        .addTo(map);
    };
    const onLeave = () => {
      if (!showing) return;
      showing = false;
      popupRef.current?.remove();
    };
    for (const id of ids) {
      map.on("mousemove", id, onMove);
      map.on("mouseleave", id, onLeave);
    }
    return () => {
      for (const id of ids) {
        map.off("mousemove", id, onMove);
        map.off("mouseleave", id, onLeave);
      }
    };
  }, [availableLayers, selectedLayerIds, mapReady, mapRef, popupRef]);

  function toggleLayer(id: string) {
    setSelectedLayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return {
    availableLayers,
    selectedLayerIds,
    toggleLayer,
  };
}

type ControlProps = {
  layers: CustomMapLayer[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
};

export function CustomLayersControl({ layers, selectedIds, onToggle }: ControlProps) {
  if (layers.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-neutral-bg/30 p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wider text-ink">
          <Layers className="size-3.5 text-primary" />
          <span>Lapisan Riset Kustom</span>
        </span>
        <span className="rounded-full bg-primary-soft px-1.5 py-0.2 text-[10px] font-semibold text-primary">
          {layers.length}
        </span>
      </div>

      <p className="text-[11px] text-ink-muted">
        Lapisan spasial yang ditambahkan oleh peneliti di CMS.
      </p>

      <div className="flex flex-col gap-1.5 mt-1">
        {layers.map((layer) => {
          const isChecked = selectedIds.has(layer.id);
          return (
            <label
              key={layer.id}
              className={cn(
                "flex items-center gap-2.5 rounded-button border px-2.5 py-1.5 cursor-pointer text-caption transition-colors",
                isChecked ? "border-primary/50 bg-surface shadow-xs" : "border-border bg-surface/50 text-ink-muted",
              )}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggle(layer.id)}
                className="size-3.5 accent-primary rounded"
              />
              <span
                className="size-3 shrink-0 rounded-full border border-black/20"
                style={{ backgroundColor: layer.color, opacity: layer.opacity }}
              />
              <div className="flex flex-1 items-center justify-between min-w-0">
                <span className="truncate font-medium text-ink">{layer.name}</span>
                {layer.layerType === "polygon" && <Pentagon className="size-3 shrink-0 text-ink-muted ml-1" />}
                {layer.layerType === "line" && <Spline className="size-3 shrink-0 text-ink-muted ml-1" />}
                {layer.layerType === "point" && <CircleDot className="size-3 shrink-0 text-ink-muted ml-1" />}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
