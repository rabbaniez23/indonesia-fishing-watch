"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Database,
  FileText,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  TrendingUp,
  Users,
  Waves,
  X,
  type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/lib/auth/actions";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";
import type { SafeUser } from "@/lib/auth/service";
import { cn } from "@/lib/cn";

type CmsNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  hidden?: boolean;
};

const CMS_NAV_ITEMS: CmsNavItem[] = [
  { href: "/cms", label: "Ikhtisar CMS", icon: LayoutDashboard },
  { href: "/cms/data", label: "Data & Dataset Riset", icon: Database },
  // Disembunyikan sementara sesuai permintaan
  { href: "/cms/layers", label: "Lapisan Peta Kustom", icon: Layers, hidden: true },
  { href: "/cms/analysis", label: "Catatan Analisis (/analysis)", icon: TrendingUp, hidden: true },
  { href: "/cms/articles", label: "Konten & Panduan", icon: FileText, hidden: true },
  { href: "/cms/activity", label: "Log Audit Aktivitas", icon: Activity, hidden: true },
  { href: "/cms/users", label: "Pengguna & Akses", icon: Users, adminOnly: true, hidden: true },
  { href: "/cms/settings", label: "Pengaturan Sistem", icon: Settings, adminOnly: true },
];

type CmsShellProps = {
  children: ReactNode;
  user: SafeUser;
};

export function CmsShell({ children, user }: CmsShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAdmin = user.role === "admin";

  const navItems = CMS_NAV_ITEMS.filter(
    (item) => !item.hidden && (!item.adminOnly || isAdmin),
  );

  function isActive(href: string) {
    if (href === "/cms") return pathname === "/cms";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="flex min-h-dvh bg-neutral-bg/40">
      {/* Sidebar Desktop */}
      <aside className="glass-strong fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border md:flex">
        {/* Brand Header */}
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-5">
          <div className="flex size-9 items-center justify-center rounded-button bg-primary text-inverse shadow-xs">
            <Waves className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-ink leading-none">IFW Studio</span>
              <span className="rounded-button bg-primary-soft px-1.5 py-0.5 text-[10px] font-bold text-primary">
                CMS
              </span>
            </div>
            <p className="truncate text-caption text-ink-muted">Panel Pengelola Riset</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Menu Manajemen
          </div>
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-button px-3 py-2 text-body font-medium transition-colors",
                      active
                        ? "bg-primary text-inverse shadow-xs"
                        : "text-ink hover:bg-surface hover:text-primary",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sidebar Footer: Back to Front-end & User Account */}
        <div className="border-t border-border p-3 flex flex-col gap-2">
          {/* Back to main website button */}
          <Link
            href="/overview"
            className="flex items-center gap-2 rounded-button border border-border bg-surface px-3 py-2 text-caption font-medium text-ink transition-colors hover:border-primary hover:text-primary"
          >
            <ArrowLeft className="size-4 shrink-0 text-primary" />
            <span>Kembali ke Website Utama</span>
          </Link>

          {/* User info & logout */}
          <div className="flex items-center justify-between rounded-card bg-neutral-bg/60 p-2 text-caption">
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{user.name}</p>
              <p className="text-caption text-ink-muted">{ROLE_LABELS[user.role]}</p>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                title="Keluar"
                className="rounded-button p-1.5 text-ink-muted hover:bg-neutral-bg hover:text-ink"
              >
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-ink/40 backdrop-blur-xs" onClick={() => setMobileMenuOpen(false)} />
          <div className="glass-strong relative z-10 flex w-72 flex-col border-r border-border p-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Waves className="size-5 text-primary" />
                <span className="font-semibold text-ink">IFW Studio · CMS</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-button p-1 text-ink-muted hover:text-ink"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="mt-4 flex-1">
              <ul className="flex flex-col gap-1">
                {navItems.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-button px-3 py-2.5 text-body font-medium",
                          active ? "bg-primary text-inverse" : "text-ink hover:bg-surface",
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="border-t border-border pt-3">
              <Link
                href="/overview"
                className="flex items-center gap-2 rounded-button border border-border bg-surface px-3 py-2.5 text-caption font-medium text-ink"
              >
                <ArrowLeft className="size-4 text-primary" />
                <span>Kembali ke Website Utama</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col md:pl-64">
        {/* Top Header */}
        <header className="glass-card sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-border px-4 md:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-button p-2 text-ink-muted hover:bg-surface md:hidden"
            >
              <Menu className="size-5" />
            </button>
            <span className="text-body font-semibold text-ink">Panel Pengelola Riset & Konten</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/overview"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-button border border-border bg-surface/80 px-3 py-1.5 text-caption font-medium text-ink transition-colors hover:border-primary hover:text-primary"
            >
              <ArrowLeft className="size-3.5 text-primary" />
              <span>Lihat Website</span>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
