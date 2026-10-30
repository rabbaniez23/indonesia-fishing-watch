"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  Radar,
  Radio,
  Satellite,
  Waves,
  Eye,
  Ship,
  Sparkles,
  MapPin,
  TrendingUp,
  Activity,
  Layers,
} from "lucide-react";
import type { SafeUser } from "@/lib/auth/service";

interface HotspotDetail {
  id: string;
  name: string;
  zone: string;
  coords: string;
  apparentFishingHours: string;
  vesselsCount: number;
  viirsDetections: number;
  sst: string;
  status: "Normal" | "Tinggi" | "Peringatan";
  statusColor: string;
}

const HOTSPOTS: HotspotDetail[] = [
  {
    id: "natuna",
    name: "Laut Natuna Utara",
    zone: "WPP-NRI 711",
    coords: "4°12'N 108°24'E",
    apparentFishingHours: "1.428 jam",
    vesselsCount: 46,
    viirsDetections: 184,
    sst: "29.4°C",
    status: "Tinggi",
    statusColor: "text-amber-700 bg-amber-50 border-amber-200",
  },
  {
    id: "arafura",
    name: "Laut Arafura & Aru",
    zone: "WPP-NRI 718",
    coords: "8°45'S 136°10'E",
    apparentFishingHours: "2.190 jam",
    vesselsCount: 68,
    viirsDetections: 215,
    sst: "28.1°C",
    status: "Peringatan",
    statusColor: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  {
    id: "jawa",
    name: "Laut Jawa & Karimata",
    zone: "WPP-NRI 712",
    coords: "5°30'S 111°15'E",
    apparentFishingHours: "980 jam",
    vesselsCount: 34,
    viirsDetections: 92,
    sst: "29.8°C",
    status: "Normal",
    statusColor: "text-blue-700 bg-blue-50 border-blue-200",
  },
  {
    id: "malaka",
    name: "Selat Malaka",
    zone: "WPP-NRI 571",
    coords: "2°40'N 101°30'E",
    apparentFishingHours: "870 jam",
    vesselsCount: 52,
    viirsDetections: 48,
    sst: "30.1°C",
    status: "Tinggi",
    statusColor: "text-amber-700 bg-amber-50 border-amber-200",
  },
];

export function LandingHero({ user }: { user: SafeUser | null }) {
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotDetail>(HOTSPOTS[0]);

  return (
    <section id="beranda" className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden bg-gradient-to-b from-[#F2F7F3] via-[#F8FAF8] to-white scroll-mt-20">
      {/* Background Subtle Maritime Grid / Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-tr from-primary/10 via-[#B7E34B]/15 to-transparent rounded-full blur-3xl opacity-70" />
        <div className="absolute top-1/3 -left-32 w-80 h-80 bg-teal-500/10 rounded-full blur-2xl" />
        <div className="absolute top-1/2 -right-32 w-80 h-80 bg-emerald-500/10 rounded-full blur-2xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Top Badge */}
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/20 bg-primary-soft/80 text-primary text-xs font-semibold mb-6 shadow-xs backdrop-blur-sm">
            <Sparkles className="size-3.5 text-primary" />
            <span>Platform Riset & Intelijen Perikanan Berbasis Satelit</span>
            <span className="w-1.5 h-1.5 rounded-full bg-primary/40" />
            <span className="text-ink-muted">11 WPP-NRI</span>
          </div>

          {/* Heading */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-ink tracking-tight leading-[1.15] mb-6">
            Transparansi & Pengawasan Maritim di Seluruh{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-[#1F7A46] to-teal-700">
              Perairan Indonesia
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg md:text-xl text-ink-muted leading-relaxed max-w-3xl mb-8">
            Menghubungkan pelacakan AIS kapal dari Global Fishing Watch, sensor malam VIIRS, dan data oseanografi Copernicus Marine untuk analisis perikanan yang akurat, transparan, dan berbasis sains.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4 w-full sm:w-auto">
            {user ? (
              <Link
                href="/overview"
                className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-primary text-white text-base font-semibold shadow-md hover:bg-primary-hover transition-all hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
              >
                <span>Buka Dashboard ({user.name})</span>
                <ArrowRight className="size-5" />
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-primary text-white text-base font-semibold shadow-md hover:bg-primary-hover transition-all hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
              >
                <span>Masuk ke Platform</span>
                <ArrowRight className="size-5" />
              </Link>
            )}
            <a
              href="#fitur"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white border border-border text-ink hover:bg-surface-subtle transition-all text-base font-medium shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span>Pelajari Fitur Platform</span>
            </a>
          </div>

          {/* Trust/Metric Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 mt-12 w-full pt-8 border-t border-border/70 text-left">
            <div className="p-3.5 rounded-xl bg-white/70 border border-border/60 shadow-xs backdrop-blur-sm">
              <div className="flex items-center gap-2 text-primary text-xs font-semibold mb-1">
                <Radio className="size-3.5" /> 11 WPP-NRI
              </div>
              <p className="text-lg font-bold text-ink">Seluruh ZEE</p>
              <p className="text-xs text-ink-muted">Cakupan perairan resmi KKP</p>
            </div>
            <div className="p-3.5 rounded-xl bg-white/70 border border-border/60 shadow-xs backdrop-blur-sm">
              <div className="flex items-center gap-2 text-teal-700 text-xs font-semibold mb-1">
                <Radar className="size-3.5" /> AIS & SAR
              </div>
              <p className="text-lg font-bold text-ink">Global Fishing Watch</p>
              <p className="text-xs text-ink-muted">Algoritma apparent fishing</p>
            </div>
            <div className="p-3.5 rounded-xl bg-white/70 border border-border/60 shadow-xs backdrop-blur-sm">
              <div className="flex items-center gap-2 text-amber-700 text-xs font-semibold mb-1">
                <Satellite className="size-3.5" /> VIIRS DNB
              </div>
              <p className="text-lg font-bold text-ink">Deteksi Malam</p>
              <p className="text-xs text-ink-muted">Kapal berlampu tanpa AIS</p>
            </div>
            <div className="p-3.5 rounded-xl bg-white/70 border border-border/60 shadow-xs backdrop-blur-sm">
              <div className="flex items-center gap-2 text-blue-700 text-xs font-semibold mb-1">
                <Waves className="size-3.5" /> Bio-Fisika Laut
              </div>
              <p className="text-lg font-bold text-ink">Copernicus Marine</p>
              <p className="text-xs text-ink-muted">Suhu, salinitas, & klorofil</p>
            </div>
          </div>
        </div>

        {/* Interactive Visual Dashboard Preview (WOW Element) */}
        <div className="mt-6 rounded-2xl border border-border/90 bg-white shadow-xl overflow-hidden">
          {/* Top Mockup Window Header */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-surface-subtle border-b border-border">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-red-400" />
              <span className="w-3 h-3 rounded-full bg-amber-400" />
              <span className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="ml-2 text-xs font-medium text-ink-muted flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-primary" />
                <span>Indonesia Maritime Operations · Live Telemetry Simulator</span>
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Koneksi Satelit Aktif
              </span>
              <span className="hidden md:inline text-ink-muted">Resolusi Grid: 0,05°</span>
            </div>
          </div>

          {/* Interactive Screen Body */}
          <div className="p-4 sm:p-6 lg:p-8 bg-[#0C1E17] text-white relative">
            {/* Visual Radar Background Pattern */}
            <div
              className="absolute inset-0 opacity-15 pointer-events-none"
              style={{
                backgroundImage: `radial-gradient(circle at 50% 50%, rgba(183, 227, 75, 0.4) 1px, transparent 1px),
                                  linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px),
                                  linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)`,
                backgroundSize: "40px 40px",
              }}
            />

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Map & Hotspot Selector Visualization */}
              <div className="lg:col-span-7 bg-[#112920]/90 rounded-xl p-5 border border-emerald-900/60 shadow-inner">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Radar className="size-4 text-accent-lime animate-spin text-emerald-400" style={{ animationDuration: "12s" }} />
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                      Peta Pantau Maritim · Klik Titik Hotspot
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-400/80 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">
                    4 Titik Pantau Utama
                  </span>
                </div>

                {/* Simulated Geographic Radar Area */}
                <div className="relative w-full h-64 sm:h-72 rounded-lg bg-[#071711] border border-emerald-900/50 overflow-hidden flex items-center justify-center">
                  {/* Radar Circles */}
                  <div className="absolute w-48 h-48 rounded-full border border-emerald-500/20" />
                  <div className="absolute w-72 h-72 rounded-full border border-emerald-500/15" />
                  <div className="absolute w-full h-[1px] bg-emerald-500/20" />
                  <div className="absolute h-full w-[1px] bg-emerald-500/20" />

                  {/* SVG Simplified Nusantara Archipelago Silhouette Contour */}
                  <svg
                    className="absolute inset-0 w-full h-full opacity-35"
                    viewBox="0 0 600 300"
                    fill="none"
                    stroke="#53AC6C"
                    strokeWidth="1.2"
                  >
                    {/* Sumatra & Malaka */}
                    <path d="M 60 70 L 140 160 L 180 210 L 160 220 L 100 150 Z" />
                    {/* Java */}
                    <path d="M 180 230 L 320 240 L 350 245 L 340 255 L 180 242 Z" />
                    {/* Kalimantan & Natuna */}
                    <path d="M 200 90 L 280 90 L 300 160 L 220 180 Z" />
                    {/* Sulawesi */}
                    <path d="M 330 110 L 370 120 L 360 180 L 380 210 L 350 190 Z" />
                    {/* Papua & Arafura */}
                    <path d="M 450 140 L 560 150 L 570 210 L 480 210 Z" />
                  </svg>

                  {/* Hotspots Interactive Buttons on Map */}
                  {HOTSPOTS.map((hotspot, idx) => {
                    const isSelected = selectedHotspot.id === hotspot.id;
                    // Mock coordinates positioning
                    const positions: Record<string, { top: string; left: string }> = {
                      natuna: { top: "28%", left: "34%" },
                      arafura: { top: "72%", left: "82%" },
                      jawa: { top: "76%", left: "42%" },
                      malaka: { top: "35%", left: "18%" },
                    };
                    const pos = positions[hotspot.id] || { top: "50%", left: "50%" };

                    return (
                      <button
                        key={hotspot.id}
                        type="button"
                        onClick={() => setSelectedHotspot(hotspot)}
                        style={{ top: pos.top, left: pos.left }}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 group transition-all z-20 focus:outline-none`}
                        aria-label={`Pilih ${hotspot.name}`}
                      >
                        <span className="relative flex items-center justify-center">
                          {isSelected && (
                            <span className="absolute w-8 h-8 rounded-full bg-emerald-400/40 animate-ping" />
                          )}
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-transform group-hover:scale-125 ${
                              isSelected
                                ? "bg-accent-lime text-black border-white shadow-lg"
                                : "bg-emerald-600/80 text-white border-emerald-300"
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          </span>
                        </span>
                        <span
                          className={`absolute left-1/2 -translate-x-1/2 top-6 whitespace-nowrap text-[11px] font-medium px-2 py-0.5 rounded shadow-sm border transition-all ${
                            isSelected
                              ? "bg-white text-ink border-white font-bold"
                              : "bg-[#071711]/90 text-emerald-200 border-emerald-800"
                          }`}
                        >
                          {hotspot.name}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Hotspots Quick Switch Bar */}
                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-emerald-900/60">
                  {HOTSPOTS.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => setSelectedHotspot(h)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                        selectedHotspot.id === h.id
                          ? "bg-emerald-800 text-white border-emerald-500 font-semibold shadow-xs"
                          : "bg-emerald-950/60 text-emerald-300/80 border-emerald-900/80 hover:bg-emerald-900/60"
                      }`}
                    >
                      <MapPin className="size-3" />
                      <span>{h.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Hotspot Telemetry Live Card */}
              <div className="lg:col-span-5 bg-gradient-to-br from-[#133026] to-[#0D221A] rounded-xl p-5 border border-emerald-700/40 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-emerald-800/80">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">
                      Wilayah Terpilih ({selectedHotspot.zone})
                    </span>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2 mt-0.5">
                      <span>{selectedHotspot.name}</span>
                    </h3>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${selectedHotspot.statusColor}`}>
                    Status: {selectedHotspot.status}
                  </span>
                </div>

                <div className="py-4 space-y-3.5">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[#0A1A14]/70 border border-emerald-900/60">
                    <div className="flex items-center gap-2.5 text-xs text-emerald-200">
                      <Ship className="size-4 text-emerald-400" />
                      <span>Apparent Fishing (GFW)</span>
                    </div>
                    <span className="text-sm font-bold text-white">{selectedHotspot.apparentFishingHours}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-[#0A1A14]/70 border border-emerald-900/60">
                    <div className="flex items-center gap-2.5 text-xs text-emerald-200">
                      <Satellite className="size-4 text-amber-400" />
                      <span>Deteksi Kapal Malam (VIIRS)</span>
                    </div>
                    <span className="text-sm font-bold text-amber-300">{selectedHotspot.viirsDetections} deteksi</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-[#0A1A14]/70 border border-emerald-900/60">
                    <div className="flex items-center gap-2.5 text-xs text-emerald-200">
                      <Activity className="size-4 text-teal-400" />
                      <span>Kapal Teramati Aktif</span>
                    </div>
                    <span className="text-sm font-bold text-teal-300">{selectedHotspot.vesselsCount} kapal</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-[#0A1A14]/70 border border-emerald-900/60">
                    <div className="flex items-center gap-2.5 text-xs text-emerald-200">
                      <Waves className="size-4 text-blue-400" />
                      <span>Suhu Permukaan Laut (SST)</span>
                    </div>
                    <span className="text-sm font-bold text-blue-300">{selectedHotspot.sst}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <Link
                    href={user ? "/overview" : "/login"}
                    className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors shadow-sm"
                  >
                    <span>Eksplorasi Detail Wilayah di Platform</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                  <p className="text-[10px] text-center text-emerald-400/60 mt-2">
                    Data agregasi berkala berdasarkan integrasi satelit GFW v3 & VIIRS NOAA.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
