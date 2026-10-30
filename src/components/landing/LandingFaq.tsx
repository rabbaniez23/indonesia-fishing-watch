"use client";

import { useState } from "react";
import { HelpCircle, ChevronDown } from "lucide-react";

interface FaqItem {
  q: string;
  a: string;
}

const FAQS: FaqItem[] = [
  {
    q: "Bagaimana cara mendapatkan akses masuk ke platform Indonesia Fishing Watch?",
    a: "Platform ini saat ini beroperasi dalam fase pilot riset maritim internal dengan akses berbasis undangan. Tidak ada formulir pendaftaran akun publik terbuka. Akses diberikan oleh Administrator kepada peneliti, analis kelautan, dan stakeholder terkait melalui tautan undangan terenkripsi.",
  },
  {
    q: "Apakah seluruh kapal nelayan di Indonesia terlacak di dalam sistem ini?",
    a: "Tidak semua kapal nelayan memancarkan sinyal AIS (Automatic Identification System), terutama kapal tradisional berukuran kecil di bawah 30 GT. Untuk mengisi kesenjangan data tersebut, platform mengintegrasikan sensor satelit VIIRS (Day/Night Band) yang mampu mendeteksi keberadaan kapal-kapal berlampu malam (seperti penangkap cumi dan bagan) meskipun tidak mengaktifkan AIS.",
  },
  {
    q: "Apa perbedaan antara Apparent Fishing Hours dan Vessel Presence Hours?",
    a: "Vessel Presence Hours mengukur total waktu kapal berada di suatu sel grid perairan berdasarkan sinyal transponder. Sedangkan Apparent Fishing Hours dihitung menggunakan algoritma machine learning Global Fishing Watch yang menganalisis perubahan kecepatan, belokan, dan pola lintasan manuver khas saat kapal menurunkan jaring atau alat tangkap aktif.",
  },
  {
    q: "Dapatkah data maritim dan grafik diekspor untuk analisis mandiri?",
    a: "Ya. Platform menyediakan modul Laporan khusus bagi pengguna terdaftar untuk mengekspor data teragregasi dalam format file CSV/ZIP. Setiap paket unduhan menyertakan metadata lengkap, rentang waktu pengamatan, serta hash verifikasi untuk keperluan publikasi jurnal dan riset akademik.",
  },
  {
    q: "Apakah platform ini terafiliasi resmi dengan Global Fishing Watch?",
    a: "Indonesia Fishing Watch adalah platform inisiatif riset independen yang memanfaatkan API dan dataset terbuka dari Global Fishing Watch. Platform ini tidak berafiliasi secara korporat, tidak mewakili, dan tidak didanai secara langsung oleh Global Fishing Watch.",
  },
  {
    q: "Bagaimana sistem memetakan batas 11 WPP-NRI?",
    a: "Batas 11 Wilayah Pengelolaan Perikanan diimpor langsung dari Shapefile geospasial resmi Kementerian Kelautan dan Perikanan (KKP) Republik Indonesia. Hal ini menjamin keselarasan data spasial dengan regulasi kelautan nasional.",
  },
];

export function LandingFaq() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-24 bg-white border-t border-border/70">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-soft text-primary text-xs font-semibold mb-3">
            <HelpCircle className="size-3.5" />
            <span>Tanya Jawab</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight mb-4">
            Pertanyaan yang Sering Diajukan
          </h2>
          <p className="text-base text-ink-muted">
            Informasi penting seputar akses platform, batasan metodologi, dan sumber data pemantauan.
          </p>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={faq.q}
                className="rounded-2xl border border-border/80 bg-surface-subtle/30 overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className="w-full flex items-center justify-between p-5 sm:p-6 text-left font-bold text-ink hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-expanded={isOpen}
                >
                  <span className="text-base sm:text-lg pr-4">{faq.q}</span>
                  <ChevronDown
                    className={`size-5 text-ink-muted shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-primary" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 sm:px-6 pb-6 pt-1 text-sm sm:text-base text-ink-muted leading-relaxed border-t border-border/50 animate-in fade-in duration-150">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
