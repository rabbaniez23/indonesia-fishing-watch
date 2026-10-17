"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChevronDown, Menu, PanelLeftClose, PanelLeftOpen, Waves, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { NAV_GROUPS, NAV_ITEMS, findNavItem, type NavItem } from "./nav-items";

type SidebarMode = "auto" | "expanded" | "collapsed";

type AppShellProps = {
  children: ReactNode;
  isAdmin?: boolean;
  /** Slot akun di topbar (diisi setelah autentikasi tersedia). */
  account?: ReactNode;
};

/**
 * Shell aplikasi (DS §6.1, §6.2):
 * - >= 1280px: sidebar expanded 232px (collapsed default di halaman Peta)
 * - 1024–1279px: sidebar collapsed 72px
 * - < 1024px: navigasi lewat drawer dari tombol menu
 */
export function AppShell({ children, isAdmin = false, account }: AppShellProps) {
  const pathname = usePathname();
  const isMap = pathname === "/map" || pathname.startsWith("/map/");
  const [preference, setPreference] = useState<SidebarMode | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mode: SidebarMode = preference ?? (isMap ? "collapsed" : "auto");
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
  const current = findNavItem(pathname);

  const isWide = useMediaQuery("(min-width: 1280px)");
  const visuallyExpanded = mode === "expanded" || (mode === "auto" && isWide);

  function toggleSidebar() {
    setPreference(visuallyExpanded ? "collapsed" : "expanded");
  }

  return (
    <div className="min-h-dvh">
      <a
        href="#konten-utama"
        className="sr-only z-[90] rounded-button bg-primary px-4 py-3 text-inverse focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Lewati ke konten utama
      </a>

      {/* Sidebar desktop */}
      <aside
        className={cn(
          "glass-strong fixed inset-y-0 left-0 z-30 hidden flex-col border-r transition-[width] duration-150 lg:flex",
          mode === "auto" && "w-[72px] xl:w-[232px]",
          mode === "expanded" && "w-[232px]",
          mode === "collapsed" && "w-[72px]",
        )}
        data-mode={mode}
      >
        <SidebarContents
          items={items}
          pathname={pathname}
          labelClass={mode === "auto" ? "hidden xl:inline" : mode === "expanded" ? "inline" : "hidden"}
          // Lipatan kelompok hanya berlaku saat label terlihat; mode ikon selalu menampilkan semua menu.
          foldClass={mode === "auto" ? "xl:hidden" : mode === "expanded" ? "hidden" : ""}
          dividerClass={mode === "auto" ? "block xl:hidden" : mode === "expanded" ? "hidden" : "block"}
          collapsedTooltip={mode !== "expanded"}
          footerSlot={
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={visuallyExpanded ? "Ciutkan menu" : "Perluas menu"}
              className="flex h-11 w-full items-center gap-3 rounded-nav px-3 text-ink-muted hover:bg-surface-subtle hover:text-ink"
            >
              {mode === "collapsed" ? (
                <PanelLeftOpen className="size-5 shrink-0" aria-hidden />
              ) : (
                <PanelLeftClose className="size-5 shrink-0" aria-hidden />
              )}
              <span className={cn(mode === "auto" ? "hidden xl:inline" : mode === "expanded" ? "inline" : "hidden")}>
                Ciutkan menu
              </span>
            </button>
          }
        />
      </aside>

      {/* Drawer navigasi tablet/mobile */}
      <MobileNav open={drawerOpen} onClose={() => setDrawerOpen(false)} items={items} pathname={pathname} />

      <div
        className={cn(
          "flex min-h-dvh min-w-0 flex-col transition-[padding] duration-150",
          mode === "auto" && "lg:pl-[72px] xl:pl-[232px]",
          mode === "expanded" && "lg:pl-[232px]",
          mode === "collapsed" && "lg:pl-[72px]",
        )}
      >
        <header className="glass-strong sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b px-4 md:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Buka menu navigasi"
            aria-expanded={drawerOpen}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-button border border-border lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-card-title font-semibold">{current?.title ?? "Indonesia Fishing Watch"}</p>
            <p className="truncate text-caption text-ink-muted">Perairan Indonesia</p>
          </div>
          <Link
            href="/dokumentasi"
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-button px-3 text-ink-muted hover:bg-surface-subtle hover:text-ink"
          >
            <BookOpen className="size-5" aria-hidden />
            <span className="hidden sm:inline">Dokumentasi</span>
            <span className="sr-only sm:hidden">Dokumentasi</span>
          </Link>
          {account}
        </header>
        <main id="konten-utama" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarContents({
  items,
  pathname,
  labelClass,
  foldClass,
  dividerClass,
  collapsedTooltip,
  footerSlot,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  labelClass: string;
  /** Kelas untuk menyembunyikan isi kelompok yang dilipat. */
  foldClass: string;
  /** Kelas garis pemisah pengganti judul kelompok saat hanya ikon. */
  dividerClass: string;
  collapsedTooltip: boolean;
  footerSlot?: ReactNode;
  onNavigate?: () => void;
}) {
  const footer = items.filter((item) => item.group === "footer");
  const activeHref = findNavItem(pathname)?.href;
  const activeGroup = items.find((item) => item.href === activeHref)?.group;
  // Bawaan: hanya kelompok halaman aktif yang terbuka agar sidebar ringkas; kelompok lain dibuka dengan klik judulnya
  // (pilihan bertahan selama sesi).
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  return (
    <>
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-button bg-primary-soft text-primary">
          <Waves className="size-5" aria-hidden />
        </span>
        <span className={cn("min-w-0", labelClass)}>
          {/* Nama panjang: boleh dua baris agar tidak terpotong di sidebar 232px. */}
          <span className="block text-body leading-5 font-semibold text-balance">Indonesia Fishing Watch</span>
        </span>
      </div>
      <nav aria-label="Navigasi utama" className="flex min-h-0 flex-1 flex-col justify-between gap-4 overflow-y-auto p-3">
        <div className="flex flex-col gap-2">
          {NAV_GROUPS.map((group, gi) => {
            const groupItems = items.filter((item) => item.group === group.key);
            if (!groupItems.length) return null;
            const open = group.key === activeGroup || !!opened[group.key];
            const listId = `menu-${group.key}`;
            return (
              <div key={group.key} className="flex flex-col gap-1">
                {gi > 0 ? <span aria-hidden className={cn("mx-2 my-1 border-t border-border", dividerClass)} /> : null}
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={listId}
                  // Kelompok halaman aktif selalu terbuka; klik judulnya tidak melipat.
                  onClick={() => group.key !== activeGroup && setOpened((o) => ({ ...o, [group.key]: !open }))}
                  className={cn(
                    "h-8 items-center justify-between rounded-nav px-3 text-caption font-semibold tracking-wide text-ink-muted uppercase hover:text-ink",
                    labelClass === "inline" ? "flex" : labelClass === "hidden" ? "hidden" : "hidden xl:flex",
                  )}
                >
                  {group.label}
                  <ChevronDown className={cn("size-4 transition-transform duration-150", !open && "-rotate-90")} aria-hidden />
                </button>
                <ul id={listId} aria-label={group.label} className={cn("flex flex-col gap-1", !open && foldClass)}>
                  {groupItems.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      active={item.href === activeHref}
                      labelClass={labelClass}
                      tooltip={collapsedTooltip}
                      onNavigate={onNavigate}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <ul className="flex flex-col gap-1 border-t border-border pt-3">
          {footer.map((item) => (
            <NavLink key={item.href} item={item} active={item.href === activeHref} labelClass={labelClass} tooltip={collapsedTooltip} onNavigate={onNavigate} />
          ))}
          {footerSlot ? <li>{footerSlot}</li> : null}
        </ul>
      </nav>
    </>
  );
}

function NavLink({
  item,
  active,
  labelClass,
  tooltip,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  labelClass: string;
  tooltip: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <li className="group relative">
      <Link
        href={item.href}
        aria-label={item.label}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
        className={cn(
          "relative flex h-11 items-center gap-3 rounded-nav px-3 transition-colors duration-150",
          active
            ? "bg-primary-soft font-semibold text-primary before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-primary"
            : "text-ink-muted hover:bg-surface-subtle hover:text-ink",
        )}
      >
        <Icon className="size-5 shrink-0" aria-hidden />
        <span className={cn("truncate", labelClass)}>{item.label}</span>
      </Link>
      {tooltip ? (
        <span
          role="presentation"
          className={cn(
            "pointer-events-none absolute top-1/2 left-full z-50 ml-2 hidden -translate-y-1/2 rounded-input bg-ink px-2 py-1 text-caption whitespace-nowrap text-inverse shadow-overlay",
            "group-hover:block group-focus-within:block",
            labelClass.includes("xl:inline") && "xl:!hidden",
          )}
        >
          {item.label}
        </span>
      ) : null}
    </li>
  );
}

function MobileNav({
  open,
  onClose,
  items,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  pathname: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const lastPath = useRef(pathname);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Tutup drawer setelah berpindah halaman.
  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      onClose();
    }
  }, [pathname, onClose]);

  return (
    <dialog
      ref={ref}
      aria-label="Menu navigasi"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="m-0 h-dvh max-h-dvh w-[min(300px,calc(100vw-48px))] max-w-none glass-strong border-r p-0 text-ink backdrop:bg-ink/30 backdrop:backdrop-blur-sm lg:hidden"
    >
      <div className="relative flex h-full flex-col">
        <SidebarContents items={items} pathname={pathname} labelClass="inline" foldClass="hidden" dividerClass="hidden" collapsedTooltip={false} onNavigate={onClose} />
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup menu navigasi"
          className="absolute top-2.5 right-2 inline-flex size-11 items-center justify-center rounded-button hover:bg-surface-subtle"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
    </dialog>
  );
}

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
