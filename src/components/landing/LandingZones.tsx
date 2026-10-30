"use client";

import { useState } from "react";
import { Compass, MapPin, Fish, Waves, Shield, ArrowRight } from "lucide-react";

interface WppZone {
  code: string;
  name: string;
  description: string;
  targetSpecies: string[];
  characteristic: string;
  intensity: "Sangat Tinggi" | "Tinggi" | "Sedang";
  intensityColor: string;
}

const WPP_ZONES: WppZone[] = [
  {
    code: "571",
    name: "Selat Malaka & Laut Andaman",
    description: "Jalur pelayaran tersibuk di dunia dan perairan dangkal perikanan tangkap perbatasan barat.",
    targetSpecies: ["Ikan Kembung", "Teri", "Udang Putih"],
    characteristic: "Perairan semi-tertutup dengan lalu lintas kapal niaga sangat padat dan armada pukat.",
    intensity: "Sangat Tinggi",
    intensityColor: "bg-red-50 text-red-700 border-red-200",
  },
  {
    code: "572",
    name: "Samudera Hindia Barat Sumatera",
    description: "Perairan laut dalam oseanik langsung menghadap samudera terbuka dengan palung dalam.",
    targetSpecies: ["Tuna Mata Besar", "Cakalang", "Madidihang"],
    characteristic: "Karakteristik oseanik dalam dengan dominasi armada longline pelagis besar.",
    intensity: "Sedang",
    intensityColor: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    code: "573",
    name: "Samudera Hindia Selatan Jawa - Nusa Tenggara",
    description: "Wilayah upwelling musiman kuat yang didorong angin monsun tenggara.",
    targetSpecies: ["Tuna Sirip Biru Selatan", "Lemuru", "Layang"],
    characteristic: "Kondisi oseanografi dinamis dengan fenomena upwelling musiman kaya klorofil.",
    intensity: "Tinggi",
    intensityColor: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    code: "711",
    name: "Selat Karimata, Laut Natuna, & Laut Natuna Utara",
    description: "Zona perbatasan strategis dengan potensi perikanan demersal dan pelagis melimpah.",
    targetSpecies: ["Cumi-cumi", "Tongkol", "Kerapu"],
    characteristic: "Titik fokus pengawasan maritim perbatasan dan deteksi kapal malam VIIRS tertinggi.",
    intensity: "Sangat Tinggi",
    intensityColor: "bg-red-50 text-red-700 border-red-200",
  },
  {
    code: "712",
    name: "Laut Jawa",
    description: "Perairan paparan dangkal (Sundaland) dengan konsentrasi armada nelayan tradisional dan pukat cincin.",
    targetSpecies: ["Ikan Kembung", "Bawal Hitam", "Rajungan"],
    characteristic: "Tekanan penangkapan intensif dengan ribuan kapal lokal aktif sepanjang tahun.",
    intensity: "Sangat Tinggi",
    intensityColor: "bg-red-50 text-red-700 border-red-200",
  },
  {
    code: "713",
    name: "Selat Makassar, Teluk Bone, Laut Flores, & Laut Bali",
    description: "Koridor Arus Lintas Indonesia (Arlindo) utama yang menghubungkan Samudera Pasifik dan Hindia.",
    targetSpecies: ["Cakalang", "Ikan Terbang", "Tongkol"],
    characteristic: "Dinamika arus laut dalam yang kuat dan jalur migrasi pelagis kecil.",
    intensity: "Tinggi",
    intensityColor: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    code: "714",
    name: "Teluk Tolo & Laut Banda",
    description: "Cekungan laut dalam dengan keanekaragaman terumbu karang dan habitat tuna laut dalam.",
    targetSpecies: ["Tuna Sirip Kuning", "Cakalang", "Layaran"],
    characteristic: "Daerah penangkapan tuna penting dengan kedalaman palung mencapai ribuan meter.",
    intensity: "Sedang",
    intensityColor: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    code: "715",
    name: "Teluk Tomini, Laut Maluku, Halmahera, Seram, & Berau",
    description: "Gugusan teluk dan laut pedalaman kepulauan rempah dengan produktivitas tinggi.",
    targetSpecies: ["Cakalang", "Tongkol Komo", "Kerapu Sunu"],
    characteristic: "Topografi laut kepulauan dengan perpaduan perairan tenang dan celah selat berarus.",
    intensity: "Tinggi",
    intensityColor: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    code: "716",
    name: "Laut Sulawesi & Utara Pulau Halmahera",
    description: "Wilayah perbatasan utara menghadap perairan Filipina dan Pasifik Barat Daya.",
    targetSpecies: ["Tuna Mata Besar", "Cakalang", "Layang"],
    characteristic: "Jalur penangkapan tuna internasional dengan pergerakan armada lintas batas.",
    intensity: "Tinggi",
    intensityColor: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    code: "717",
    name: "Teluk Cendrawasih & Samudera Pasifik",
    description: "Perairan paling timur Indonesia dengan ekosistem laut purba dan terumbu karang terjaga.",
    targetSpecies: ["Tuna Sirip Kuning", "Cakalang", "Tenggiri"],
    characteristic: "Karakter perairan Pasifik terbuka dengan kelimpahan sumber daya yang masih luas.",
    intensity: "Sedang",
    intensityColor: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    code: "718",
    name: "Laut Aru, Laut Arafuru, & Laut Timor Bagian Timur",
    description: "Salah satu perairan paling produktif di dunia, kaya udang penaeid dan ikan demersal.",
    targetSpecies: ["Udang Jerbung", "Ikan Kakap Merah", "Bawal Putih"],
    characteristic: "Paparan Sahul dangkal yang subur, menjadi pusat armada pukat dasar dan jaring insang.",
    intensity: "Sangat Tinggi",
    intensityColor: "bg-red-50 text-red-700 border-red-200",
  },
];

export function LandingZones() {
  const [selectedCode, setSelectedCode] = useState<string>("711");
  const selectedZone = WPP_ZONES.find((z) => z.code === selectedCode) || WPP_ZONES[3];

  return (
    <section id="wilayah" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-soft text-primary text-xs font-semibold mb-3">
            <Compass className="size-3.5" />
            <span>Zonasi Wilayah Nasional</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight mb-4">
            Cakupan 11 Wilayah Pengelolaan Perikanan (WPP-NRI)
          </h2>
          <p className="text-base sm:text-lg text-ink-muted">
            Setiap jengkal perairan Indonesia memiliki karakteristik oseanografi dan pola penangkapan yang unik. Klik kode WPP untuk melihat profil ringkasnya.
          </p>
        </div>

        {/* WPP Badges Navigator */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          {WPP_ZONES.map((zone) => {
            const isSelected = zone.code === selectedCode;
            return (
              <button
                key={zone.code}
                type="button"
                onClick={() => setSelectedCode(zone.code)}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isSelected
                    ? "bg-primary text-white shadow-md scale-105"
                    : "bg-surface-subtle hover:bg-emerald-50 text-ink-muted hover:text-ink border border-border/80"
                }`}
              >
                WPP {zone.code}
              </button>
            );
          })}
        </div>

        {/* Selected Zone Card Showcase */}
        <div className="bg-gradient-to-br from-[#F5FAF6] to-white rounded-2xl border border-border p-6 sm:p-10 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Info */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-3 py-1 rounded-lg bg-primary text-white text-xs font-bold">
                  WPP-NRI {selectedZone.code}
                </span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${selectedZone.intensityColor}`}>
                  Tekanan Penangkapan: {selectedZone.intensity}
                </span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-extrabold text-ink">
                {selectedZone.name}
              </h3>

              <p className="text-sm sm:text-base text-ink-muted leading-relaxed">
                {selectedZone.description}
              </p>

              <div className="p-4 rounded-xl bg-white border border-border/80 shadow-2xs space-y-2">
                <div className="text-xs font-bold text-ink flex items-center gap-2">
                  <Waves className="size-4 text-primary" />
                  <span>Karakteristik Oseanografi & Armada:</span>
                </div>
                <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                  {selectedZone.characteristic}
                </p>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-ink-muted block mb-2">
                  Komoditas Tangkapan Utama:
                </span>
                <div className="flex flex-wrap gap-2">
                  {selectedZone.targetSpecies.map((sp) => (
                    <span
                      key={sp}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-border text-xs font-medium text-ink"
                    >
                      <Fish className="size-3 text-teal-600" />
                      <span>{sp}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Mini Stats Visual */}
            <div className="lg:col-span-5 bg-white rounded-xl p-6 border border-border shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <span className="text-xs font-bold text-ink">Status Monitoring Terpadu</span>
                <span className="flex items-center gap-1.5 text-xs text-primary font-semibold">
                  <Shield className="size-3.5" /> Shapefile KKP Terverifikasi
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-ink-muted">Resolusi Lapisan Grid</span>
                  <span className="font-semibold text-ink">0,05° (~5,5 km)</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-ink-muted">Sensor Aktif</span>
                  <span className="font-semibold text-ink">AIS + VIIRS + SAR</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-ink-muted">Dataset Suhu Laut</span>
                  <span className="font-semibold text-ink">Copernicus CMEMS Bulanan</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-ink-muted">Cakupan Zona</span>
                  <span className="font-semibold text-ink">Perairan Teritorial & ZEE</span>
                </div>
              </div>

              <div className="pt-2">
                <a
                  href="#faq"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
                >
                  <span>Pelajari cara data WPP divalidasi</span>
                  <ArrowRight className="size-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
