import {
  Anchor,
  ChartLine,
  ClipboardList,
  Database,
  Droplets,
  FileDown,
  LayoutDashboard,
  Map as MapIcon,
  Satellite,
  Settings,
  Ship,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  /** Judul halaman di topbar. */
  title: string;
  icon: LucideIcon;
  group: "main" | "footer";
  adminOnly?: boolean;
};

/** Menu MVP PRD §7.2. Fitur di luar scope tidak dimasukkan sebagai menu. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/overview", label: "Ringkasan", title: "Ringkasan", icon: LayoutDashboard, group: "main" },
  { href: "/map", label: "Peta", title: "Peta aktivitas", icon: MapIcon, group: "main" },
  { href: "/vessels", label: "Kapal", title: "Kapal", icon: Ship, group: "main" },
  { href: "/ports", label: "Pelabuhan", title: "Pelabuhan", icon: Anchor, group: "main" },
  { href: "/analysis", label: "Analisis", title: "Analisis", icon: ChartLine, group: "main" },
  { href: "/viirs", label: "VIIRS", title: "VIIRS · Deteksi kapal malam", icon: Satellite, group: "main" },
  { href: "/preprocessing-viirs", label: "Preprocessing VIIRS", title: "Preprocessing VIIRS", icon: Workflow, group: "main" },
  { href: "/oseanografi", label: "Oseanografi", title: "Oseanografi", icon: Droplets, group: "main" },
  { href: "/findings", label: "Temuan", title: "Temuan", icon: ClipboardList, group: "main" },
  { href: "/reports", label: "Laporan", title: "Laporan", icon: FileDown, group: "main" },
  { href: "/data-status", label: "Tentang data", title: "Tentang data", icon: Database, group: "footer" },
  { href: "/settings", label: "Pengaturan", title: "Pengaturan", icon: Settings, group: "footer", adminOnly: true },
];

export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
