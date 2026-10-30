"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Waves, ArrowRight, LogIn, Menu, X, ShieldCheck } from "lucide-react";
import type { SafeUser } from "@/lib/auth/service";

export function LandingNavbar({ user }: { user: SafeUser | null }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Menu disederhanakan sesuai permintaan pengguna: Beranda, Tentang Kami (About), FAQ, Kontak
  const navLinks = [
    { label: "Beranda", href: "#beranda" },
    { label: "Tentang Kami", href: "#about" },
    { label: "FAQ", href: "#faq" },
    { label: "Kontak", href: "#kontak" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-white/90 backdrop-blur-md shadow-sm border-b border-border/80 py-3"
          : "bg-white/70 backdrop-blur-sm border-b border-border/40 py-4"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg">
            <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary text-white shadow-sm transition-transform group-hover:scale-105">
              <Waves className="size-5" aria-hidden />
            </span>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-ink">Indonesia Fishing Watch</span>
                <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary-soft text-primary">
                  <ShieldCheck className="size-3" /> Riset
                </span>
              </div>
              <span className="text-xs text-ink-muted">Pemantauan Maritim Terpadu</span>
            </div>
          </Link>

          {/* Desktop Nav Items: Beranda, Tentang Kami, FAQ, Kontak */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-semibold text-ink-muted hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded py-1"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Action Button */}
          <div className="hidden sm:flex items-center gap-3">
            {user ? (
              <Link
                href="/overview"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-hover shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
              >
                <span>Buka Platform</span>
                <ArrowRight className="size-4" />
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-hover shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
              >
                <LogIn className="size-4" />
                <span>Masuk ke Sistem</span>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Buka menu navigasi"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-white px-4 pt-3 pb-6 shadow-lg animate-in slide-in-from-top-2 duration-200">
          <nav className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 text-sm font-semibold text-ink hover:bg-surface-subtle rounded-lg transition-colors"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-3 border-t border-border mt-1">
              {user ? (
                <Link
                  href="/overview"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-hover"
                >
                  <span>Buka Platform ({user.name})</span>
                  <ArrowRight className="size-4" />
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-hover"
                >
                  <LogIn className="size-4" />
                  <span>Masuk ke Sistem</span>
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
