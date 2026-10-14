import Link from "next/link";
import { Anchor, ChartLine, Map as MapIcon, Ship } from "lucide-react";

const ITEMS = [
  { href: "/map", icon: MapIcon, title: "Lihat peta", text: "Di mana kapal paling ramai beraktivitas." },
  { href: "/vessels", icon: Ship, title: "Lihat daftar kapal", text: "Kapal paling aktif dan riwayat kegiatannya." },
  { href: "/ports", icon: Anchor, title: "Cek pelabuhan", text: "Pelabuhan yang paling sering disinggahi." },
  { href: "/analysis?tab=perbandingan", icon: ChartLine, title: "Bandingkan periode", text: "Apakah aktivitas naik atau turun?" },
] as const;

/** Panduan awal: menjelaskan aplikasi ini untuk apa dan memberi 4 titik mulai yang jelas. */
export function QuickStart({ query }: { query: string }) {
  return (
    <section
      aria-labelledby="judul-mulai"
      className="relative isolate overflow-hidden rounded-card bg-primary bg-linear-to-br from-[#0b4126] via-[#125a30] to-[#0b5550] p-5 text-inverse shadow-[0_18px_40px_-18px_rgba(13,74,42,0.6)] sm:p-7"
    >
      {/* Ornamen cahaya; dekoratif saja. */}
      <span aria-hidden className="pointer-events-none absolute -top-24 -right-16 -z-10 size-72 rounded-full bg-teal-300/10 blur-3xl" />
      <span aria-hidden className="pointer-events-none absolute -bottom-28 left-1/3 -z-10 size-72 rounded-full bg-lime-300/[0.07] blur-3xl" />
      <h2 id="judul-mulai" className="text-section-title font-semibold">
        Mau mulai dari mana?
      </h2>
      <p className="mt-1 max-w-3xl text-white/90">
        Indonesia Fishing Watch merangkum data kapal dari Global Fishing Watch agar mudah dibaca: di mana kapal beraktivitas, kapal apa saja,
        dan pelabuhan mana yang mereka singgahi.
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ITEMS.map(({ href, icon: Icon, title, text }) => (
          <li key={href}>
            <Link
              href={`${href}${href.includes("?") ? "&" : "?"}${query}`}
              className="group flex h-full items-start gap-3 rounded-button border border-white/25 bg-white/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-md transition duration-150 hover:-translate-y-0.5 hover:bg-white/18 focus-visible:outline-white"
            >
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white/90 text-primary shadow-sm">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold text-white">{title}</span>
                <span className="text-caption text-white/90">{text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
