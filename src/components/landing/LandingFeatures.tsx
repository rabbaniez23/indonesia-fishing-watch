import {
  Ship,
  Satellite,
  Waves,
  MapPin,
  Anchor,
  FileCheck2,
  Cpu,
  Layers,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";

interface FeatureCardProps {
  icon: typeof Ship;
  tag: string;
  tagColor: string;
  title: string;
  description: string;
  details: string[];
}

const FEATURES: FeatureCardProps[] = [
  {
    icon: Ship,
    tag: "AIS & GFW",
    tagColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    title: "Pelacakan Apparent Fishing Berbasis AI",
    description:
      "Model machine learning Global Fishing Watch menganalisis dinamika lintasan, kecepatan, dan manuver kapal untuk mendeteksi penangkapan ikan secara objektif.",
    details: [
      "Klasifikasi alat tangkap: Trawl, Purse Seine, Longline",
      "Perhitungan jam penangkapan vs jam keberadaan (vessel presence)",
      "Agregasi grid spasial 0,05° x 0,05° tanpa asumsi interpolasi fiktif",
    ],
  },
  {
    icon: Satellite,
    tag: "Satelit VIIRS",
    tagColor: "bg-amber-100 text-amber-800 border-amber-200",
    title: "Deteksi Kapal Malam (Boat Detection)",
    description:
      "Sensor Day/Night Band (DNB) pada satelit Suomi-NPP dan NOAA-20 mendeteksi kapal berlampu terang (cumi, bagan) yang seringkali tidak memancarkan AIS.",
    details: [
      "Mengatasi titik buta (blindspot) kapal perikanan tanpa transponder AIS",
      "Analisis musiman dan siklus bulan (fase lunar) terhadap aktivitas",
      "Pembersihan otomatis radiasi flare gas dan deteksi daratan",
    ],
  },
  {
    icon: Waves,
    tag: "Oseanografi",
    tagColor: "bg-blue-100 text-blue-800 border-blue-200",
    title: "Biofisika Laut & Daerah Penangkapan",
    description:
      "Integrasi parameter oseanografi dari Copernicus Marine Service untuk memahami habitat dan korelasi kondisi laut dengan konsentrasi armada tangkap.",
    details: [
      "Suhu Permukaan Laut (Sea Surface Temperature / SST)",
      "Konsentrasi Klorofil-a sebagai bio-indikator fitoplankton",
      "Salinitas air laut dan vektor kecepatan arus perairan",
    ],
  },
  {
    icon: MapPin,
    tag: "11 WPP-NRI",
    tagColor: "bg-teal-100 text-teal-800 border-teal-200",
    title: "Zonasi Resmi Pengelolaan Perikanan",
    description:
      "Pemetaan komprehensif mengikuti 11 Wilayah Pengelolaan Perikanan Negara Republik Indonesia (WPP-NRI) dan Zona Ekonomi Eksklusif (ZEE).",
    details: [
      "Batas resmi shapefile KKP yang diverifikasi",
      "Statistik perbandingan intensitas penangkapan antar-wilayah",
      "Identifikasi hotspot tangkap di setiap sel perairan",
    ],
  },
  {
    icon: Anchor,
    tag: "Armada & Pelabuhan",
    tagColor: "bg-indigo-100 text-indigo-800 border-indigo-200",
    title: "Profil Kapal & Riwayat Singgah Pelabuhan",
    description:
      "Database identitas kapal mencakup MMSI, IMO, bendera negara asal, serta riwayat singgah pelabuhan (port visits) teramati.",
    details: [
      "Pencarian cepat identitas kapal dan kebangsaan bendera",
      "Agregasi kunjungan ke pelabuhan utama di seluruh nusantara",
      "Deteksi anomali identitas dan perubahan transmisi transponder",
    ],
  },
  {
    icon: FileCheck2,
    tag: "Audit & Kerja",
    tagColor: "bg-purple-100 text-purple-800 border-purple-200",
    title: "Manajemen Temuan & Ekspor Terverifikasi",
    description:
      "Alat bantu analis untuk mencatat bukti aktivitas mencurigakan, riwayat audit yang tidak bisa dimanipulasi, dan ekspor data riset.",
    details: [
      "Penyimpanan temuan berbasis snapshot data dan catatan append-only",
      "Status peninjauan (Baru, Ditinjau, Terverifikasi, Diarsipkan)",
      "Unduhan paket laporan ZIP berisi CSV data lengkap beserta metadata",
    ],
  },
];

export function LandingFeatures() {
  return (
    <section id="fitur" className="py-24 bg-white border-y border-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-soft text-primary text-xs font-semibold mb-3">
            <Cpu className="size-3.5" />
            <span>Kapabilitas Inti Sistem</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight mb-4">
            Dirancang Khusus untuk Analisis Maritim Presisi Tinggi
          </h2>
          <p className="text-base sm:text-lg text-ink-muted leading-relaxed">
            Menggabungkan teknologi satelit penginderaan jauh, kecerdasan buatan, dan oseanografi untuk menyajikan gambaran utuh perairan Indonesia.
          </p>
        </div>

        {/* 6 Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group relative p-6 sm:p-7 rounded-2xl bg-[#FBFDFB] hover:bg-white border border-border/80 hover:border-primary/40 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar with Icon & Tag */}
                  <div className="flex items-center justify-between mb-5">
                    <span className="p-3 rounded-xl bg-white border border-border group-hover:border-primary/30 group-hover:bg-primary-soft/50 text-primary transition-colors shadow-xs">
                      <Icon className="size-6" />
                    </span>
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${feature.tagColor}`}>
                      {feature.tag}
                    </span>
                  </div>

                  {/* Title & Desc */}
                  <h3 className="text-xl font-bold text-ink mb-2.5 group-hover:text-primary transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-ink-muted leading-relaxed mb-5">
                    {feature.description}
                  </p>
                </div>

                {/* Details List */}
                <div className="pt-4 border-t border-border/60">
                  <ul className="space-y-2">
                    {feature.details.map((detail) => (
                      <li key={detail} className="flex items-start gap-2 text-xs text-ink/80">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
