"use client";

import { useState } from "react";
import dotsJson from "@/data/landing/wpp-dots.json";
import { CountUp, Reveal, useInView } from "./landing-motion";
import { FOCUS, SectionIntro, WRAP } from "./landing-ui";

export type LandingWpp = { code: string; name: string; detections: number; share: number };

const DOTS = dotsJson as unknown as { viewBox: string; dotSize: number; wpp: Record<string, { center: [number, number]; path: string }> };
const ACCENT = "#D08A3E";

export function LandingZones({ zones, period }: { zones: LandingWpp[]; period: string }) {
  const [code, setCode] = useState("711");
  const [mapRef, mapSeen] = useInView<SVGSVGElement>(0.25);
  const zone = zones.find((z) => z.code === code) ?? zones[0];

  return (
    <section id="wilayah" className="scroll-mt-20 bg-black py-24 md:py-32">
      <div className={`${WRAP} grid items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)]`}>
        <div className="flex flex-col gap-10">
          <SectionIntro title="11 WPP">Pilih satu wilayah pengelolaan perikanan untuk melihat jumlah deteksi kapal malamnya.</SectionIntro>

          <Reveal>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Pilih WPP">
              {zones.map((z) => (
                <button
                  key={z.code}
                  type="button"
                  onClick={() => setCode(z.code)}
                  aria-pressed={z.code === code}
                  className={`border px-3 py-2 text-sm font-bold tracking-wider transition-colors ${FOCUS} ${
                    z.code === code ? "border-white bg-white text-black" : "border-white/45 text-white hover:border-white"
                  }`}
                >
                  {z.code}
                </button>
              ))}
            </div>
          </Reveal>

          <Reveal className="flex flex-col gap-4 border-t border-white/25 pt-6">
            <div aria-live="polite" className="flex flex-col gap-1">
              <p className="text-sm font-bold tracking-[0.14em] text-[#D08A3E] uppercase">WPP {zone.code}</p>
              <p className="text-2xl leading-tight font-bold tracking-wide uppercase">{zone.name}</p>
            </div>
            <div>
              <p className="text-[clamp(1.75rem,3.2vw,2.75rem)] leading-none font-bold">
                <CountUp value={zone.detections} />
              </p>
              <p className="mt-1 text-sm font-light text-white/80">
                deteksi kapal malam, {new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(zone.share)}% dari total, {period}
              </p>
            </div>
          </Reveal>
        </div>

        <svg ref={mapRef} viewBox={DOTS.viewBox} className="w-full" role="img" aria-label="Peta titik 11 wilayah pengelolaan perikanan Indonesia">
          {zones.map((z, index) => (
            <path
              key={z.code}
              d={DOTS.wpp[z.code].path}
              stroke={z.code === code ? ACCENT : "#ffffff"}
              strokeOpacity={z.code === code ? 0.95 : 0.42}
              strokeWidth={DOTS.dotSize}
              strokeLinecap="round"
              onClick={() => setCode(z.code)}
              style={{ transitionDelay: mapSeen ? `${index * 90}ms` : undefined }}
              className={`cursor-pointer transition-[opacity,stroke,stroke-opacity] duration-500 hover:stroke-white hover:[stroke-opacity:0.9] motion-reduce:opacity-100 motion-reduce:transition-none ${
                mapSeen ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}
          {zones.map((z, index) => {
            const [x, y] = DOTS.wpp[z.code].center;
            const active = z.code === code;
            return (
              <circle
                key={z.code}
                cx={x}
                cy={y}
                r={active ? 16 : 9}
                fill={ACCENT}
                style={{ animationDelay: `${index * 180}ms`, transitionDelay: mapSeen ? `${500 + index * 90}ms` : undefined, transitionProperty: "r" }}
                className={`pointer-events-none duration-300 ${mapSeen ? "landing-pulse" : "opacity-0 motion-reduce:opacity-60"}`}
                opacity={0.55}
              />
            );
          })}
        </svg>
      </div>
    </section>
  );
}
