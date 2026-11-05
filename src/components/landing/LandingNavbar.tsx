"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import type { SafeUser } from "@/lib/auth/service";
import { LandingLogo } from "./LandingLogo";
import { AccessLink, FOCUS, LABEL, UpiMark, WRAP } from "./landing-ui";

const NAV_LINKS = [
  { label: "Beranda", href: "#beranda" },
  { label: "Data", href: "#data" },
  { label: "Wilayah", href: "#wilayah" },
  { label: "Tim", href: "#tim" },
  { label: "FAQ", href: "#faq" },
  { label: "Kontak", href: "#kontak" },
];

export function LandingNavbar({ user }: { user: SafeUser | null }) {
  const [pastHero, setPastHero] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("beranda");
    if (!hero) return;
    const onScroll = () => setPastHero(hero.getBoundingClientRect().bottom < 90);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${pastHero || open ? "bg-black/90" : "bg-transparent"}`}>
      <div className={`${WRAP} flex items-center justify-between py-4`}>
        <div className="flex items-center gap-3">
          <Link href="/" aria-label="Indonesia Fishing Watch, kembali ke atas" className={FOCUS}>
            <LandingLogo />
          </Link>
          <UpiMark size={50} showName={false} />
        </div>

        <nav aria-label="Navigasi landing" className="hidden items-center gap-5 md:flex lg:gap-7">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className={`text-white/85 transition-colors hover:text-white ${FOCUS} ${LABEL}`}>
              {link.label}
            </a>
          ))}
          <AccessLink user={user} compact />
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`p-2 text-white md:hidden ${FOCUS}`}
          aria-label={open ? "Tutup menu" : "Buka menu"}
          aria-expanded={open}
        >
          {open ? <X className="size-6" strokeWidth={1.5} /> : <Menu className="size-6" strokeWidth={1.5} />}
        </button>
      </div>

      {open && (
        <nav aria-label="Navigasi landing" className={`${WRAP} flex flex-col gap-1 pb-6 md:hidden`}>
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setOpen(false)} className={`py-2.5 text-white ${FOCUS} ${LABEL}`}>
              {link.label}
            </a>
          ))}
          <div className="pt-3">
            <AccessLink user={user} compact />
          </div>
        </nav>
      )}
    </header>
  );
}
