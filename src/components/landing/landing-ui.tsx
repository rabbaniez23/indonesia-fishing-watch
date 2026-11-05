import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import type { SafeUser } from "@/lib/auth/service";
import { Reveal, RevealRule, RevealTitle } from "./landing-motion";

/** Konten mepet ke tepi layar dengan jarak yang sama di semua bagian landing. */
export const WRAP = "w-full px-5 sm:px-8 lg:px-12";
/** Teks kapital kecil berjarak longgar, gaya utama landing. */
export const LABEL = "text-xs font-bold tracking-[0.14em] uppercase";
export const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

const TITLE = "text-[clamp(3.25rem,min(10vw,13svh),7.25rem)] leading-[0.94] font-bold tracking-[-0.01em] text-[#C8CCD0] uppercase";

export function Rule() {
  return <span aria-hidden className="block h-1.5 w-14 bg-white/75" />;
}

export function BigTitle({ children }: { children: ReactNode }) {
  return <h1 className={TITLE}>{children}</h1>;
}

/** Kepala bagian: judul besar, lalu garis dan teks pengantar pada satu garis tepi kiri. */
export function SectionIntro({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-7">
      <RevealTitle className={TITLE}>{title}</RevealTitle>
      <div className="flex flex-col gap-6">
        <RevealRule />
        {children && (
          <Reveal delay={150} className="max-w-[60ch] text-base leading-relaxed font-light tracking-wide text-white/85 uppercase">
            {children}
          </Reveal>
        )}
      </div>
    </div>
  );
}

/** Foto laut di belakang satu bagian: bergeser pelan saat scroll dan menyatu ke hitam di tepi atas-bawah. */
export function SectionPhoto({ src, opacity = "opacity-50" }: { src: string; opacity?: string }) {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <Image src={src} alt="" fill unoptimized sizes="100vw" className={`landing-drift object-cover ${opacity}`} />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#000_0%,rgb(0_0_0/0.2)_26%,rgb(0_0_0/0.2)_70%,#000_100%)]" />
    </div>
  );
}

export function UpiMark({ size = 56, showName = true }: { size?: number; showName?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      {/* Bagian bawah logo berwarna hitam, jadi diberi cincin putih agar tidak hilang di latar gelap. */}
      <span className="inline-flex shrink-0 rounded-full bg-white p-0.5">
        <Image src="/landing/logo-upi.png" alt="Logo Universitas Pendidikan Indonesia" width={size} height={size} unoptimized />
      </span>
      {showName && <span className="max-w-[14ch] text-left text-xs leading-tight font-bold tracking-[0.1em] uppercase">Universitas Pendidikan Indonesia</span>}
    </span>
  );
}

export function AccessLink({ user, compact = false }: { user: SafeUser | null; compact?: boolean }) {
  return (
    <Link
      href={user ? "/overview" : "/login"}
      className={`inline-flex items-center gap-2 border border-white/60 text-white transition-colors hover:bg-white hover:text-black ${FOCUS} ${LABEL} ${compact ? "px-3 py-2" : "px-5 py-3.5"}`}
    >
      {user ? "Buka platform" : "Masuk"}
      <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
    </Link>
  );
}
