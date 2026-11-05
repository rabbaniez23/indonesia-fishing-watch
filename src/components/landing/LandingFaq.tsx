import { ChevronDown } from "lucide-react";
import { Reveal } from "./landing-motion";
import { FOCUS, SectionIntro, WRAP } from "./landing-ui";

const FAQS = [
  {
    q: "Bagaimana cara mendapatkan akses?",
    a: "Akun dibuat lewat undangan dari Admin. Saat ini belum ada pendaftaran terbuka untuk publik.",
  },
  {
    q: "Apakah semua kapal terpantau?",
    a: "Tidak. Banyak kapal, terutama kapal kecil, tidak mengirim sinyal AIS. Data VIIRS membantu melihat kapal berlampu pada malam hari, tetapi tidak menunjukkan identitas kapalnya.",
  },
  {
    q: "Apa beda jam penangkapan dan jam keberadaan?",
    a: "Jam keberadaan adalah lama kapal berada di suatu area. Jam penangkapan adalah perkiraan Global Fishing Watch berapa lama kapal tampak menangkap ikan, dibaca dari pola geraknya.",
  },
  {
    q: "Apakah datanya bisa diunduh?",
    a: "Ya. Pengguna terdaftar dapat mengunduh laporan lewat menu Laporan, berupa paket ZIP berisi data CSV dan metadatanya.",
  },
  {
    q: "Apakah platform ini bagian dari Global Fishing Watch?",
    a: "Bukan. Indonesia Fishing Watch adalah inisiatif riset independen yang memakai data terbuka Global Fishing Watch.",
  },
];

export function LandingFaq() {
  return (
    <section id="faq" className="scroll-mt-20 bg-black py-24 md:py-32">
      <div className={`${WRAP} grid items-start gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]`}>
        <div className="lg:sticky lg:top-28">
          <SectionIntro title="FAQ">Jawaban singkat soal akses, cakupan, dan sumber data.</SectionIntro>
        </div>
        <div className="border-t border-white/25">
          {FAQS.map((faq, index) => (
            <Reveal key={faq.q} delay={index * 70}>
              <details name="faq-landing" className="group border-b border-white/25">
                <summary
                  className={`flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-lg font-bold tracking-wide uppercase transition-colors hover:text-[#D08A3E] [&::-webkit-details-marker]:hidden ${FOCUS}`}
                >
                  {faq.q}
                  <ChevronDown className="size-5 shrink-0 transition-transform duration-300 group-open:rotate-180" strokeWidth={1.5} aria-hidden />
                </summary>
                <p className="max-w-[68ch] pb-6 leading-relaxed font-light text-white/85">{faq.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
