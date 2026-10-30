import Link from "next/link";
import { Waves, ArrowRight, ShieldCheck, ExternalLink } from "lucide-react";
import type { SafeUser } from "@/lib/auth/service";

export function LandingFooter({ user }: { user: SafeUser | null }) {
  return (
    <footer className="bg-[#091712] text-white pt-20 pb-12 border-t border-emerald-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Pre-footer CTA Banner */}
        <div className="relative mb-20 p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-[#143D2D] via-[#16513A] to-[#0F3728] border border-emerald-700/60 shadow-2xl overflow-hidden">
          <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-accent-lime/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-900/80 text-emerald-300 border border-emerald-700/80 text-xs font-semibold mb-3">
                <ShieldCheck className="size-3.5" /> Akses Khusus Peneliti & Analis
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
                Mulai Eksplorasi Data Pemantauan Maritim
              </h3>
              <p className="text-sm sm:text-base text-emerald-100/80 leading-relaxed">
                Akses dashboard analitik, peta interaktif 11 WPP-NRI, dan data satelit malam VIIRS sekarang juga.
              </p>
            </div>
            <div className="shrink-0 w-full sm:w-auto">
              {user ? (
                <Link
                  href="/overview"
                  className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white text-ink hover:bg-emerald-50 text-sm font-bold shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <span>Buka Dashboard ({user.name})</span>
                  <ArrowRight className="size-4" />
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3.5 rounded-xl bg-accent-lime hover:bg-[#a6d13d] text-[#172B22] text-sm font-bold shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <span>Masuk ke Platform</span>
                  <ArrowRight className="size-4" />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Footer Navigation Columns */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-emerald-950">
          {/* Brand Info */}
          <div className="md:col-span-1 space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-primary text-white">
                <Waves className="size-5" />
              </span>
              <span className="text-base font-bold text-white">Indonesia Fishing Watch</span>
            </div>
            <p className="text-xs text-emerald-300/70 leading-relaxed">
              Platform riset integratif pemantauan aktivitas maritim di perairan Indonesia berbasis data Global Fishing Watch, VIIRS, dan Copernicus Marine.
            </p>
            <div className="text-[11px] text-emerald-400/60">
              Pilot Internal · Khusus Penggunaan Riset & Analisis
            </div>
          </div>

          {/* Quick Links 1: Navigasi */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-4">Navigasi Platform</h4>
            <ul className="space-y-2.5 text-xs text-emerald-200/80">
              <li>
                <a href="#beranda" className="hover:text-white transition-colors">Beranda</a>
              </li>
              <li>
                <a href="#about" className="hover:text-white transition-colors">Tentang Kami</a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition-colors">Tanya Jawab (FAQ)</a>
              </li>
              <li>
                <a href="#kontak" className="hover:text-white transition-colors">Kontak Tim Riset</a>
              </li>
            </ul>
          </div>

          {/* Quick Links 2: Sumber Data */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-4">Sumber Data</h4>
            <ul className="space-y-2.5 text-xs text-emerald-200/80">
              <li>
                <a
                  href="https://globalfishingwatch.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-white transition-colors"
                >
                  <span>Global Fishing Watch API</span>
                  <ExternalLink className="size-3 text-emerald-500" />
                </a>
              </li>
              <li>
                <a
                  href="https://eogdata.mines.edu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-white transition-colors"
                >
                  <span>NOAA VIIRS Boat Detection</span>
                  <ExternalLink className="size-3 text-emerald-500" />
                </a>
              </li>
              <li>
                <a
                  href="https://marine.copernicus.eu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-white transition-colors"
                >
                  <span>Copernicus Marine Service</span>
                  <ExternalLink className="size-3 text-emerald-500" />
                </a>
              </li>
              <li>
                <span className="text-emerald-400/60">Shapefile WPP-NRI KKP RI</span>
              </li>
            </ul>
          </div>

          {/* Quick Links 3: Akses Sistem */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-4">Akses & Keamanan</h4>
            <p className="text-xs text-emerald-300/70 leading-relaxed mb-4">
              Pendaftaran akun baru dilakukan oleh administrator melalui sistem undangan terenkripsi (invite-only).
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:text-white underline underline-offset-4"
            >
              <span>Halaman Masuk Petugas →</span>
            </Link>
          </div>
        </div>

        {/* Bottom Disclaimer & Copyright */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-emerald-400/60">
          <p>
            © 2026 Indonesia Fishing Watch. Didedikasikan untuk transparansi perikanan dan kelestarian laut nusantara.
          </p>
          <p className="text-center md:text-right">
            Data maritim untuk kebutuhan riset · Tidak menggantikan sistem pemantauan resmi VMS.
          </p>
        </div>
      </div>
    </footer>
  );
}
