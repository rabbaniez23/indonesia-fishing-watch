import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { CountUp, Reveal } from "./landing-motion";
import { FOCUS, LABEL, SectionIntro, WRAP } from "./landing-ui";

export type LandingStats = { detections: number; period: string; oceanVariables: number; wpp: number };

const SOURCES = [
  {
    id: "sumber-gfw",
    name: "Global Fishing Watch",
    role: "Aktivitas kapal",
    text: "Pergerakan kapal dari sinyal AIS, diambil lewat API. Pembaruannya otomatis, sekitar 4–5 hari setelah kejadian.",
    url: "https://globalfishingwatch.org",
  },
  {
    id: "sumber-viirs",
    name: "VIIRS Boat Detection",
    role: "Kapal malam",
    text: "Deteksi kapal berlampu dari satelit, termasuk kapal yang tidak mengirim sinyal AIS. Berupa ringkasan yang diperbarui manual.",
    url: "https://eogdata.mines.edu",
  },
  {
    id: "sumber-copernicus",
    name: "Copernicus Marine",
    role: "Kondisi laut",
    text: "Suhu, klorofil, arus, dan salinitas per bulan dan per WPP. Berupa ringkasan yang diperbarui manual.",
    url: "https://marine.copernicus.eu",
  },
];

export function LandingData({ stats }: { stats: LandingStats }) {
  const figures = [
    { value: <CountUp value={stats.detections} />, label: "deteksi kapal malam" },
    { value: stats.period, label: "periode data VIIRS" },
    { value: <CountUp value={stats.wpp} />, label: "wilayah pengelolaan perikanan" },
    { value: <CountUp value={stats.oceanVariables} />, label: "variabel kondisi laut" },
  ];

  return (
    <section id="data" className="relative scroll-mt-20 overflow-hidden bg-black py-24 md:py-32">
      {/* Gambar ini data asli: tiap titik terang adalah lokasi deteksi kapal malam VIIRS. */}
      <div aria-hidden className="absolute top-20 right-0 h-[min(46vw,640px)] w-full [mask-image:linear-gradient(to_bottom,black_70%,transparent)] lg:w-[66%]">
        <Image src="/landing/viirs-night-v1.webp" alt="" fill unoptimized sizes="70vw" className="object-contain object-right opacity-90 max-lg:opacity-40" />
      </div>

      <div className={`${WRAP} relative flex flex-col gap-16`}>
        <SectionIntro
          title={
            <>
              Asal data
              <br />
              &amp; metode
            </>
          }
        >
          Setiap angka di platform ini dapat ditelusuri ke sumbernya. Tiga sumber terbuka digabungkan untuk melihat laut Indonesia dari sisi yang berbeda.
        </SectionIntro>

        <Reveal className="text-xs font-light tracking-wider text-white/70 uppercase">
          Latar: sebaran deteksi kapal malam VIIRS, {stats.period}
        </Reveal>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-8 border-y border-white/25 py-8 md:grid-cols-4">
          {figures.map((figure, index) => (
            <Reveal key={figure.label} delay={index * 90} className="flex flex-col-reverse gap-1">
              <dt className="text-xs leading-snug font-light tracking-wider text-white/75 uppercase">{figure.label}</dt>
              <dd className="text-[clamp(1.5rem,3vw,2.25rem)] leading-none font-bold text-white">{figure.value}</dd>
            </Reveal>
          ))}
        </dl>

        <ul className="grid gap-5 md:grid-cols-3">
          {SOURCES.map((source, index) => (
            <Reveal as="li" key={source.id} delay={index * 120}>
              <div id={source.id} className="group flex h-full scroll-mt-24 flex-col gap-3 border-t-2 border-[#D08A3E] bg-white/[0.04] p-6 transition-colors hover:bg-white/[0.09] md:p-7">
                <span className={`${LABEL} text-[#D08A3E]`}>{source.role}</span>
                <h3 className="text-2xl leading-tight font-bold tracking-wide uppercase">{source.name}</h3>
                <p className="flex-1 leading-relaxed font-light text-white/85">{source.text}</p>
                <a href={source.url} target="_blank" rel="noopener noreferrer" className={`mt-2 inline-flex items-center gap-1.5 text-white/85 hover:text-white ${FOCUS} ${LABEL}`}>
                  Situs sumber
                  <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={1.5} aria-hidden />
                </a>
              </div>
            </Reveal>
          ))}
        </ul>

        <Reveal className="max-w-[70ch] text-sm leading-relaxed font-light text-white/70">
          Indonesia Fishing Watch adalah inisiatif riset independen. Platform ini memakai data terbuka Global Fishing Watch, tetapi tidak berafiliasi dengan atau mewakili Global Fishing Watch, dan tidak menggantikan sistem pemantauan resmi.
        </Reveal>
      </div>
    </section>
  );
}
