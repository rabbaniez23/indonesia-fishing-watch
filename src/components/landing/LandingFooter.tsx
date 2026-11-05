import Image from "next/image";
import { LandingLogo } from "./LandingLogo";
import { Reveal } from "./landing-motion";
import { FOCUS, LABEL, UpiMark, WRAP } from "./landing-ui";

const SOURCES = [
  { label: "Global Fishing Watch", href: "https://globalfishingwatch.org" },
  { label: "VIIRS Boat Detection", href: "https://eogdata.mines.edu" },
  { label: "Copernicus Marine", href: "https://marine.copernicus.eu" },
];

export function LandingFooter() {
  return (
    <footer className="relative overflow-hidden bg-black">
      {/* Di layar lebar logo mengisi area hitam kanan atas ombak. Posisinya dihitung dari bawah footer,
          supaya di akhir halaman selalu tepat di bawah navbar, berapa pun tinggi layarnya. */}
      <Reveal
        className={`${WRAP} relative z-10 flex flex-col items-center gap-4 pt-16 text-center lg:absolute lg:top-[max(2rem,calc(100%-100svh+6.5rem))] lg:right-0 lg:w-auto lg:items-end lg:pt-0 lg:text-right`}
      >
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 lg:justify-end">
          <UpiMark size={72} />
          <LandingLogo />
        </div>
        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 lg:justify-end">
          {SOURCES.map((source) => (
            <li key={source.href}>
              <a href={source.href} target="_blank" rel="noopener noreferrer" className={`text-white/80 hover:text-white ${FOCUS} ${LABEL} !font-normal`}>
                {source.label}
              </a>
            </li>
          ))}
        </ul>
        <p className="max-w-[60ch] text-sm font-light text-white/70">© 2026 Indonesia Fishing Watch. Data maritim untuk kebutuhan riset.</p>
      </Reveal>
      <Reveal>
        <Image src="/landing/ombak-v1.webp" alt="" width={1500} height={900} unoptimized className="relative block h-auto w-full max-lg:mt-4" />
      </Reveal>
    </footer>
  );
}
