"use client";

import { useEffect, useRef } from "react";
import { Satellite, Ship, Waves, type LucideIcon } from "lucide-react";
import type { SafeUser } from "@/lib/auth/service";
import { AccessLink, BigTitle, FOCUS, LABEL, Rule, WRAP } from "./landing-ui";

/** Urutan gambar dibuat oleh scripts/landing/build_hero_frames.py. */
const FRAME_BASE = "/landing/hero-v2";
const FRAME_COUNT = 231;

const frameUrl = (set: "d" | "m", index: number) => `${FRAME_BASE}/${set}/${String(index + 1).padStart(4, "0")}.webp`;

const CARDS: Array<{ title: string; source: string; href: string; icon: LucideIcon }> = [
  { title: "Aktivitas kapal", source: "Global Fishing Watch", href: "#sumber-gfw", icon: Ship },
  { title: "Kapal malam", source: "Satelit VIIRS", href: "#sumber-viirs", icon: Satellite },
  { title: "Kondisi laut", source: "Copernicus Marine", href: "#sumber-copernicus", icon: Waves },
];

function smoothstep(from: number, to: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/** Gambar dimuat dari yang renggang ke yang rapat, supaya scroll sudah terasa sebelum semuanya selesai. */
function loadOrder(minStep: number): number[] {
  const order = [FRAME_COUNT - 1];
  const seen = new Set(order);
  for (const step of [48, 16, 8, 4, 2, 1]) {
    if (step < minStep) break;
    for (let i = 0; i < FRAME_COUNT; i += step) {
      if (!seen.has(i)) {
        seen.add(i);
        order.push(i);
      }
    }
  }
  return order;
}

export function LandingHero({ user }: { user: SafeUser | null }) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!section || !canvas || !context) return;

    const set = window.matchMedia("(max-aspect-ratio: 1/1)").matches ? "m" : "d";
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    // Hanya untuk penghemat data atau 2G: pada koneksi lain gambar tetap dimuat bertahap, jadi tidak perlu dibatasi.
    const slow = Boolean(connection?.saveData) || /2g/.test(connection?.effectiveType ?? "");
    const images: Array<HTMLImageElement | undefined> = new Array(FRAME_COUNT);

    let cancelled = false;
    let raf = 0;
    let current = 0;
    let drawn: HTMLImageElement | undefined;

    const draw = (position: number) => {
      const index = Math.round(position);
      let image: HTMLImageElement | undefined;
      for (let distance = 0; distance < FRAME_COUNT && !image; distance++) {
        image = images[index - distance] ?? images[index + distance];
      }
      if (!image || image === drawn) return;
      drawn = image;
      context.imageSmoothingQuality = "high";
      const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    };

    const applyOverlay = (progress: number) => {
      const intro = 1 - smoothstep(0.42, 0.6, progress);
      const cards = smoothstep(0.66, 0.84, progress);
      if (introRef.current) {
        introRef.current.style.opacity = String(intro);
        introRef.current.style.visibility = intro === 0 ? "hidden" : "visible";
      }
      if (cardsRef.current) {
        cardsRef.current.style.opacity = String(cards);
        cardsRef.current.style.visibility = cards === 0 ? "hidden" : "visible";
        cardsRef.current.style.transform = `translateY(${(1 - cards) * 24}px)`;
      }
      if (hintRef.current) hintRef.current.style.opacity = String(1 - smoothstep(0, 0.06, progress));
    };

    const tick = () => {
      raf = 0;
      const rect = section.getBoundingClientRect();
      const distance = rect.height - window.innerHeight;
      const progress = distance > 0 ? Math.min(1, Math.max(0, -rect.top / distance)) : 0;
      const target = progress * (FRAME_COUNT - 1);
      // Sedikit pelembutan supaya roda mouse yang melompat tetap terasa halus.
      current += (target - current) * 0.2;
      if (Math.abs(target - current) < 0.05) current = target;
      draw(current);
      applyOverlay(current / (FRAME_COUNT - 1));
      if (current !== target) raf = requestAnimationFrame(tick);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(canvas.clientWidth * ratio);
      canvas.height = Math.round(canvas.clientHeight * ratio);
      drawn = undefined;
      schedule();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const order = loadOrder(slow ? 4 : 1);
    let cursor = 0;
    const worker = async () => {
      while (!cancelled && cursor < order.length) {
        const index = order[cursor++];
        const image = new Image();
        image.src = frameUrl(set, index);
        try {
          await image.decode();
        } catch {
          continue; // Satu frame gagal: frame terdekat yang dipakai.
        }
        if (cancelled) return;
        images[index] = image;
        drawn = undefined;
        schedule();
      }
    };
    for (let i = 0; i < 6; i++) void worker();

    window.addEventListener("scroll", schedule, { passive: true });
    schedule();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
    };
  }, []);

  return (
    <section ref={sectionRef} id="beranda" className="relative h-[340svh] bg-black motion-reduce:h-auto">
      <div className="sticky top-0 h-svh overflow-hidden motion-reduce:relative motion-reduce:h-auto motion-reduce:min-h-svh">
        {/* Di layar potret gambar dinaikkan supaya kapal tidak tertimpa judul; sisa bawahnya hitam, menyatu dengan laut. */}
        <div className="absolute inset-0 [@media(max-aspect-ratio:1/1)]:-translate-y-[21%]">
          <picture>
            <source media="(max-aspect-ratio: 1/1)" srcSet={frameUrl("m", 0)} />
            <img src={frameUrl("d", 0)} alt="" fetchPriority="high" className="absolute inset-0 size-full object-cover" />
          </picture>
          <canvas ref={canvasRef} aria-hidden className="absolute inset-0 size-full motion-reduce:hidden" />
        </div>
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_bottom,rgb(0_0_0/0.55)_0%,rgb(0_0_0/0.08)_30%,rgb(0_0_0/0.1)_50%,rgb(0_0_0/0.85)_100%)]" />

        <div
          ref={introRef}
          className={`${WRAP} absolute inset-x-0 inset-y-0 flex flex-col justify-end pt-24 pb-[clamp(2.5rem,7svh,4.5rem)] motion-reduce:relative motion-reduce:min-h-svh`}
        >
          <div className="flex flex-col items-start gap-6">
            <p className="text-xs font-bold tracking-[0.08em] text-white uppercase sm:text-sm sm:tracking-[0.14em] [@media(max-height:560px)]:hidden">Memantau aktivitas kapal di laut Indonesia</p>
            <BigTitle>
              Indonesia
              <br />
              Fishing
              <br />
              Watch
            </BigTitle>
            <Rule />
            <p className="max-w-[60ch] text-base leading-snug font-light tracking-wide text-pretty text-white/90 uppercase [@media(max-height:560px)]:hidden">
              Data kapal, deteksi satelit malam, dan kondisi laut dalam satu tempat untuk riset perikanan.
            </p>
            <AccessLink user={user} />
          </div>
        </div>

        <div ref={hintRef} aria-hidden className={`absolute right-5 bottom-8 hidden flex-col items-center gap-2 text-white/80 sm:right-8 md:flex lg:right-12 motion-reduce:hidden ${LABEL}`}>
          Gulir
          <span className="block h-10 w-px bg-white/70" />
        </div>

        <div
          ref={cardsRef}
          className={`${WRAP} invisible absolute inset-x-0 bottom-[clamp(2rem,7svh,4.5rem)] opacity-0 motion-reduce:visible motion-reduce:relative motion-reduce:bottom-0 motion-reduce:pb-12 motion-reduce:opacity-100`}
        >
          <ul className="mx-auto grid max-w-[860px] grid-cols-3 gap-2 sm:gap-6">
            {CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <li key={card.href}>
                  <a
                    href={card.href}
                    className={`flex h-full flex-col items-center gap-2 border-2 border-white/70 bg-black/35 px-2 py-4 text-center text-white transition-colors hover:bg-white hover:text-black sm:gap-3 sm:py-6 ${FOCUS}`}
                  >
                    <Icon className="size-7 sm:size-9" strokeWidth={1.1} aria-hidden />
                    <span className="text-[13px] leading-tight font-bold tracking-wider uppercase sm:text-base">{card.title}</span>
                    <span className="text-[10px] leading-tight font-light tracking-wide uppercase sm:text-xs">{card.source}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
