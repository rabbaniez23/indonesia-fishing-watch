import { Database, ShieldCheck, FileCheck, ExternalLink, BookOpen, AlertCircle } from "lucide-react";

export function LandingDataGov() {
  const sources = [
    {
      title: "Global Fishing Watch (GFW)",
      badge: "AIS & Machine Learning",
      description:
        "Data pergerakan kapal AIS global dan model estimasi penangkapan ikan (apparent fishing) yang diproses melalui API publik GFW. Menyediakan data grid spasial dan profil kapal.",
      specs: ["Skala grid 0,05° x 0,05°", "Estimasi jam penangkapan", "Kunjungan pelabuhan teramati"],
      linkText: "Dokumentasi API GFW",
      url: "https://globalfishingwatch.org",
    },
    {
      title: "VIIRS Boat Detection (EOG)",
      badge: "Satelit Malam Hari",
      description:
        "Deteksi cahaya kapal penangkap ikan malam hari dari instrumen Day/Night Band (DNB) satelit Suomi-NPP dan NOAA-20 oleh Earth Observation Group (Payne Institute).",
      specs: ["Filter anjungan suar gas", "Deteksi tanpa sinyal AIS", "Analisis fase bulan & lunar"],
      linkText: "EOG Boat Detection",
      url: "https://eogdata.mines.edu",
    },
    {
      title: "Copernicus Marine Service (CMEMS)",
      badge: "Oseanografi Fisika & Kimia",
      description:
        "Dataset biofisika kelautan dari Uni Eropa untuk pemantauan Suhu Permukaan Laut (SST), konsentrasi Klorofil-a, salinitas, dan arus perairan nusantara.",
      specs: ["Agregasi bulanan per WPP", "Indikator daerah upwelling", "Kesesuaian habitat ikan"],
      linkText: "Copernicus Marine Data",
      url: "https://marine.copernicus.eu",
    },
  ];

  return (
    <section id="metodologi" className="py-24 bg-[#0F261E] text-white relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs font-semibold mb-3">
            <Database className="size-3.5" />
            <span>Transparansi & Metodologi Sains</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Integritas Sumber Data & Provenance
          </h2>
          <p className="text-base sm:text-lg text-emerald-200/80 leading-relaxed">
            Setiap angka dan visualisasi di platform ini dapat ditelusuri kembali ke sumber aslinya. Tidak ada estimasi fiktif atau klaim sepihak tanpa bukti satelit.
          </p>
        </div>

        {/* 3 Source Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {sources.map((src) => (
            <div
              key={src.title}
              className="p-7 rounded-2xl bg-[#143228] border border-emerald-800/70 hover:border-emerald-600 transition-colors flex flex-col justify-between shadow-lg"
            >
              <div>
                <span className="inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 mb-4">
                  {src.badge}
                </span>
                <h3 className="text-xl font-bold mb-3 text-white">{src.title}</h3>
                <p className="text-sm text-emerald-100/70 leading-relaxed mb-6">
                  {src.description}
                </p>
              </div>

              <div>
                <div className="pt-4 border-t border-emerald-800/60 mb-5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-2">
                    Karakteristik Data:
                  </span>
                  <ul className="space-y-1.5">
                    {src.specs.map((spec) => (
                      <li key={spec} className="flex items-center gap-2 text-xs text-emerald-200/90">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>{spec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <span>{src.linkText}</span>
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Disclaimer / Governance Notice */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#0B1E17] border border-emerald-900/90 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800 shrink-0">
            <AlertCircle className="size-6" />
          </div>
          <div className="text-xs sm:text-sm text-emerald-200/90 leading-relaxed">
            <span className="font-bold text-white block mb-0.5">Pernyataan Independensi & Etika Riset:</span>
            Indonesia Fishing Watch adalah inisiatif penelitian independen untuk mendukung keterbukaan informasi perikanan berkelanjutan. Platform ini memanfaatkan data terbuka Global Fishing Watch namun tidak berafiliasi resmi atau mewakili entitas Global Fishing Watch. Produk ini ditujukan untuk analisis riset akademik dan tidak menggantikan sistem penegakan hukum resmi (VMS KKP).
          </div>
        </div>
      </div>
    </section>
  );
}
