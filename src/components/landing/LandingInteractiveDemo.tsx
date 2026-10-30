"use client";

import { useState } from "react";
import {
  Map as MapIcon,
  Satellite,
  Waves,
  ClipboardList,
  Layers,
  CheckCircle2,
  Sliders,
  Calendar,
  Sparkles,
  Download,
  AlertTriangle,
  FileSpreadsheet,
} from "lucide-react";

interface TabItem {
  id: string;
  name: string;
  icon: typeof MapIcon;
  badge: string;
  title: string;
  description: string;
  highlights: string[];
  mockup: React.ReactNode;
}

export function LandingInteractiveDemo() {
  const [activeTab, setActiveTab] = useState("map");

  const tabs: TabItem[] = [
    {
      id: "map",
      name: "Peta & Heatmap",
      icon: MapIcon,
      badge: "Satelit AIS",
      title: "Eksplorasi Spasial Resolusi Tinggi",
      description:
        "Visualisasikan ribuan jam aktivitas penangkapan ikan teramati di atas peta vektor interaktif dengan lapisan batas 11 WPP-NRI, deteksi radar SAR, dan detail per sel grid 0,05°.",
      highlights: [
        "Skala kuantil dinamis untuk membedakan intensitas fishing hours",
        "Layer switcher: Apparent Fishing, Vessel Presence, Radar SAR",
        "Detail drawer: klik sel untuk melihat daftar kapal dan tanggal pengamatan",
      ],
      mockup: (
        <div className="bg-[#0B1E16] text-white p-5 rounded-xl border border-emerald-900/60 font-sans shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-emerald-900/60 text-xs">
            <span className="flex items-center gap-2 text-emerald-300 font-semibold">
              <Layers className="size-4" /> Lapisan Aktif: Apparent Fishing (GFW v3)
            </span>
            <span className="bg-emerald-950 px-2 py-0.5 rounded text-emerald-400 border border-emerald-800 text-[11px]">
              Skala Kuantil 6 Kelas
            </span>
          </div>
          <div className="my-4 p-4 rounded-lg bg-[#071711] border border-emerald-950 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-emerald-200">Sel Terpilih: [Lat: 3.45°N, Lon: 108.20°E]</span>
              <span className="text-accent-lime font-bold">WPP 711 (Natuna Utara)</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded bg-emerald-950/80 border border-emerald-900">
                <span className="text-emerald-400 block text-[10px]">Apparent Fishing</span>
                <span className="text-base font-bold text-white">412.5 jam</span>
              </div>
              <div className="p-2 rounded bg-emerald-950/80 border border-emerald-900">
                <span className="text-teal-400 block text-[10px]">Vessel Presence</span>
                <span className="text-base font-bold text-white">680.2 jam</span>
              </div>
              <div className="p-2 rounded bg-emerald-950/80 border border-emerald-900">
                <span className="text-amber-400 block text-[10px]">SAR Detections</span>
                <span className="text-base font-bold text-white">18 deteksi</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-emerald-400/80">
            <span>Filter Rentang: 30 Hari Terakhir</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              11 WPP-NRI Terpetakan
            </span>
          </div>
        </div>
      ),
    },
    {
      id: "viirs",
      name: "Deteksi VIIRS",
      icon: Satellite,
      badge: "Satelit Malam",
      title: "Pemantauan Kapal Berlampu Malam Hari",
      description:
        "Banyak kapal nelayan penangkap cumi dan bagan malam tidak memancarkan AIS. Sistem memanfaatkan sensor VIIRS Day/Night Band dari satelit NOAA dan Suomi NPP untuk melacak mereka.",
      highlights: [
        "Penyaringan otomatis suar gas (gas flare) anjungan minyak lepas pantai",
        "Analisis korelasi fase bulan (fase gelap vs terang)",
        "Estimasi armada tersembunyi yang beroperasi tanpa transponder",
      ],
      mockup: (
        <div className="bg-[#121E24] text-white p-5 rounded-xl border border-cyan-900/60 font-sans shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-cyan-900/60 text-xs">
            <span className="flex items-center gap-2 text-cyan-300 font-semibold">
              <Satellite className="size-4 text-amber-400" /> Sensor VIIRS VBD (Nighttime Boat Detection)
            </span>
            <span className="bg-amber-950/80 px-2 py-0.5 rounded text-amber-300 border border-amber-800 text-[11px]">
              Suomi-NPP & NOAA-20
            </span>
          </div>
          <div className="my-4 p-4 rounded-lg bg-[#0A1318] border border-cyan-950 space-y-2.5">
            <div className="flex justify-between text-xs">
              <span className="text-cyan-200">Total Deteksi Terverifikasi (Bulan Ini)</span>
              <span className="text-amber-400 font-bold">14.820 Titik Lampu</span>
            </div>
            <div className="w-full bg-cyan-950/80 h-2.5 rounded-full overflow-hidden flex">
              <div className="bg-amber-400 h-full w-[65%]" title="Kapal Perikanan Berlampu (65%)" />
              <div className="bg-teal-500 h-full w-[25%]" title="Matched AIS (25%)" />
              <div className="bg-slate-600 h-full w-[10%]" title="Unmatched / Transit (10%)" />
            </div>
            <div className="flex items-center justify-between text-[10px] text-cyan-400/80 pt-1">
              <span>● Kapal Cumi/Bagan (65%)</span>
              <span>● AIS Cocok (25%)</span>
              <span>● Anomali (10%)</span>
            </div>
          </div>
          <p className="text-[11px] text-cyan-300/70">
            Algoritma preprocessing membersihkan noise awan tebal dan deteksi pantai secara deterministik.
          </p>
        </div>
      ),
    },
    {
      id: "ocean",
      name: "Oseanografi",
      icon: Waves,
      badge: "Copernicus Marine",
      title: "Kondisi Biofisik & Zona Potensi Ikan",
      description:
        "Laut Indonesia dipengaruhi pola muson, upwelling, dan arus lintas Indonesia (Arlindo). Parameter Copernicus Marine disandingkan untuk memahami ekologi perikanan.",
      highlights: [
        "Suhu Permukaan Laut (SST) per bulan dan deviasi historis",
        "Klorofil-a untuk mendeteksi zona kesuburan primer perairan",
        "Indeks habitat potensial ikan pelagis kecil & pelagis besar",
      ],
      mockup: (
        <div className="bg-[#0E202B] text-white p-5 rounded-xl border border-blue-900/60 font-sans shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-blue-900/60 text-xs">
            <span className="flex items-center gap-2 text-blue-300 font-semibold">
              <Waves className="size-4 text-blue-400" /> Copernicus Marine Service (CMEMS)
            </span>
            <span className="bg-blue-950 px-2 py-0.5 rounded text-blue-400 border border-blue-800 text-[11px]">
              Parameter Bulanan WPP
            </span>
          </div>
          <div className="my-4 grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-[#07131B] border border-blue-900/60">
              <span className="text-blue-300 block text-[10px] mb-1">Rata-rata Suhu Permukaan (SST)</span>
              <span className="text-xl font-extrabold text-blue-200">28.7 °C</span>
              <span className="text-[10px] text-emerald-400 block mt-1">↑ +0.4°C deviasi normal</span>
            </div>
            <div className="p-3 rounded-lg bg-[#07131B] border border-blue-900/60">
              <span className="text-blue-300 block text-[10px] mb-1">Klorofil-a (Chl-a)</span>
              <span className="text-xl font-extrabold text-emerald-300">0.42 mg/m³</span>
              <span className="text-[10px] text-emerald-400 block mt-1">Zona kesuburan tinggi</span>
            </div>
          </div>
          <div className="text-[11px] text-blue-300/70 flex items-center justify-between">
            <span>Indikator Upwelling: Terdeteksi di Selatan Jawa (WPP 573)</span>
          </div>
        </div>
      ),
    },
    {
      id: "findings",
      name: "Temuan & Ekspor",
      icon: ClipboardList,
      badge: "Alat Riset",
      title: "Catatan Investigasi & Integritas Data",
      description:
        "Analis dapat menandai sel atau kapal yang memerlukan perhatian khusus, mencatat bukti terstruktur, dan mengekspor dataset siap pakai untuk publikasi riset.",
      highlights: [
        "Pencatatan temuan berbasis bukti dengan snapshot sumber terlindungi",
        "Catatan diskusi dan peninjauan kolaboratif antar analis tim",
        "Ekspor CSV lengkap berformat ZIP disertai metadata reproduktibilitas",
      ],
      mockup: (
        <div className="bg-[#1C1A29] text-white p-5 rounded-xl border border-purple-900/60 font-sans shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-purple-900/60 text-xs">
            <span className="flex items-center gap-2 text-purple-300 font-semibold">
              <ClipboardList className="size-4 text-purple-400" /> Sistem Manajemen Temuan Analis
            </span>
            <span className="bg-purple-950 px-2 py-0.5 rounded text-purple-300 border border-purple-800 text-[11px]">
              Audit Trail Terlindungi
            </span>
          </div>
          <div className="my-4 p-3.5 rounded-lg bg-[#0F0E17] border border-purple-950 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-purple-200">ID: TMN-2026-WPP711-04</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 text-[10px] border border-emerald-800">
                Terverifikasi
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Konsentrasi 12 kapal asing teridentifikasi beroperasi di tepi batas ZEE tanpa sinyal kontinuitas pelabuhan asal.
            </p>
            <div className="pt-2 flex items-center justify-between text-[10px] text-purple-300/80 border-t border-purple-900/50">
              <span className="flex items-center gap-1">
                <FileSpreadsheet className="size-3" /> Paket Ekspor CSV + Metadata SHA-256
              </span>
              <span className="text-emerald-400 font-medium">Siap Diunduh</span>
            </div>
          </div>
          <div className="text-[11px] text-purple-300/70">
            Seluruh data temuan diautentikasi dengan peran akses granular (Viewer, Analyst, Admin).
          </div>
        </div>
      ),
    },
  ];

  const currentTab = tabs.find((t) => t.id === activeTab) || tabs[0];

  return (
    <section id="teknologi" className="py-24 bg-surface-subtle/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-soft text-primary text-xs font-semibold mb-3">
            <Sparkles className="size-3.5" />
            <span>Demonstrasi Fitur Mendalam</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight mb-4">
            Teknologi Penginderaan Jauh Terintegrasi
          </h2>
          <p className="text-base sm:text-lg text-ink-muted">
            Pilih instrumen di bawah untuk melihat bagaimana data mentah satelit diubah menjadi intelijen maritim yang siap ditindaklanjuti.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-10">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isSelected = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isSelected
                    ? "bg-primary text-white shadow-md scale-102"
                    : "bg-white text-ink-muted hover:text-ink hover:bg-surface border border-border"
                }`}
              >
                <Icon className={`size-4 ${isSelected ? "text-white" : "text-primary"}`} />
                <span>{tab.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    isSelected ? "bg-white/20 text-white" : "bg-primary-soft text-primary"
                  }`}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Box */}
        <div className="bg-white rounded-2xl border border-border p-6 sm:p-10 shadow-sm transition-all duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Description Column */}
            <div className="lg:col-span-6 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-soft text-primary text-xs font-bold">
                <span>{currentTab.badge}</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-ink">
                {currentTab.title}
              </h3>
              <p className="text-base text-ink-muted leading-relaxed">
                {currentTab.description}
              </p>
              <div className="pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-3">
                  Sorotan Fungsional
                </h4>
                <ul className="space-y-2.5">
                  {currentTab.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-ink/90">
                      <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right Mockup Display Column */}
            <div className="lg:col-span-6">
              {currentTab.mockup}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
