import {
  Anchor,
  BookOpen,
  ChartLine,
  ClipboardList,
  Database,
  Droplets,
  FileDown,
  FileText,
  FolderUp,
  History,
  Layers,
  LayoutDashboard,
  Map as MapIcon,
  NotebookPen,
  Satellite,
  Settings,
  Ship,
  SlidersHorizontal,
  ThermometerSun,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  /** Judul halaman di topbar. */
  title: string;
  /** Satu kalimat "untuk apa menu ini" — dipakai di halaman Panduan. */
  description: string;
  icon: LucideIcon;
  group: NavGroupKey;
  adminOnly?: boolean;
};

/** Sidebar dikelompokkan menurut kebutuhan pengguna, bukan menurut sumber data. */
export type NavGroupKey = "pantau" | "analisis" | "kerja" | "dokumentasi" | "kelola" | "footer";

export const NAV_GROUPS: Array<{ key: Exclude<NavGroupKey, "footer">; label: string; description: string }> = [
  { key: "pantau", label: "Pantau", description: "Lihat aktivitas kapal terbaru di laut Indonesia." },
  { key: "analisis", label: "Analisis", description: "Gali pola, tren, dan kondisi laut untuk riset." },
  { key: "kerja", label: "Hasil kerja", description: "Simpan temuan dan unduh data." },
  { key: "dokumentasi", label: "Dokumentasi", description: "Cara memakai web ini, sumber data, dan cara datanya diolah." },
  { key: "kelola", label: "Kelola", description: "CMS dan pengaturan sistem. Khusus Admin." },
];

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/overview",
    label: "Ringkasan",
    title: "Ringkasan",
    description: "Angka utama dan grafik singkat aktivitas kapal untuk wilayah dan tanggal pilihan.",
    icon: LayoutDashboard,
    group: "pantau",
  },
  {
    href: "/map",
    label: "Peta",
    title: "Peta aktivitas",
    description: "Peta aktivitas kapal GFW, ditambah lapisan VIIRS dan kondisi laut bila perlu.",
    icon: MapIcon,
    group: "pantau",
  },
  {
    href: "/vessels",
    label: "Kapal",
    title: "Kapal",
    description: "Cari kapal, lihat profil, bendera, dan riwayat kegiatannya.",
    icon: Ship,
    group: "pantau",
  },
  {
    href: "/ports",
    label: "Pelabuhan",
    title: "Pelabuhan",
    description: "Pelabuhan yang paling sering disinggahi dan kapal yang berkunjung.",
    icon: Anchor,
    group: "pantau",
  },
  {
    href: "/analysis",
    label: "Statistik aktivitas",
    title: "Statistik aktivitas",
    description: "Naik-turun harian, armada, lokasi teramai, perbandingan antar-WPP, dan kejadian di laut.",
    icon: ChartLine,
    group: "analisis",
  },
  {
    href: "/viirs",
    label: "VIIRS kapal malam",
    title: "VIIRS · Deteksi kapal malam",
    description: "Pola kapal berlampu dari satelit VIIRS: profil WPP, tren, musiman, dan prediksi.",
    icon: Satellite,
    group: "analisis",
  },
  {
    href: "/oseanografi",
    label: "Oseanografi",
    title: "Oseanografi",
    description: "Kondisi laut (suhu, klorofil, arus, dll.) per bulan dan per WPP, serta materi belajar.",
    icon: Droplets,
    group: "analisis",
  },
  {
    href: "/findings",
    label: "Temuan",
    title: "Temuan",
    description: "Catatan tim tentang aktivitas yang perlu ditinjau.",
    icon: ClipboardList,
    group: "kerja",
  },
  {
    href: "/reports",
    label: "Laporan",
    title: "Laporan",
    description: "Unduh data sebagai CSV untuk Excel atau Google Sheets.",
    icon: FileDown,
    group: "kerja",
  },
  {
    href: "/dokumentasi",
    label: "Panduan",
    title: "Dokumentasi · Panduan",
    description: "Mulai di sini: isi tiap menu, sumber data, dan kapan data diperbarui.",
    icon: BookOpen,
    group: "dokumentasi",
  },
  {
    href: "/dokumentasi/sumber-data",
    label: "Data GFW",
    title: "Dokumentasi · Data Global Fishing Watch",
    description: "Dataset GFW yang dipakai, status koneksi, cakupan wilayah, dan batasannya.",
    icon: Database,
    group: "dokumentasi",
  },
  {
    href: "/dokumentasi/preprocessing-viirs",
    label: "Data VIIRS",
    title: "Dokumentasi · Preprocessing VIIRS",
    description: "Alur cleaning dan filter data VIIRS sampai siap dianalisis.",
    icon: Workflow,
    group: "dokumentasi",
  },
  {
    href: "/dokumentasi/oseanografi",
    label: "Data oseanografi",
    title: "Dokumentasi · Data oseanografi",
    description: "Dataset Copernicus Marine yang dipakai dan cara diringkas per WPP dan per bulan.",
    icon: ThermometerSun,
    group: "dokumentasi",
  },
  // Kelola (CMS) — hanya tampil untuk Admin; halaman tetap memeriksa peran di server.
  {
    href: "/cms",
    label: "Ikhtisar CMS",
    title: "Kelola · Ikhtisar CMS",
    description: "Ringkasan isi CMS dan aktivitas tim terakhir.",
    icon: SlidersHorizontal,
    group: "kelola",
    adminOnly: true,
  },
  {
    href: "/cms/data",
    label: "Dataset riset",
    title: "Kelola · Dataset riset",
    description: "Unggah dan kelola data pengamatan (CSV) dan lapisan spasial (GeoJSON).",
    icon: FolderUp,
    group: "kelola",
    adminOnly: true,
  },
  {
    href: "/cms/layers",
    label: "Lapisan peta",
    title: "Kelola · Lapisan peta kustom",
    description: "Jadikan dataset spasial lapisan yang bisa dicentang di menu Peta.",
    icon: Layers,
    group: "kelola",
    adminOnly: true,
  },
  {
    href: "/cms/articles",
    label: "Artikel",
    title: "Kelola · Artikel",
    description: "Tulis dan terbitkan panduan atau catatan riset untuk Dokumentasi.",
    icon: FileText,
    group: "kelola",
    adminOnly: true,
  },
  {
    href: "/cms/analysis",
    label: "Catatan analisis",
    title: "Kelola · Catatan analisis",
    description: "Interpretasi dan peringatan yang tampil di menu Statistik aktivitas.",
    icon: NotebookPen,
    group: "kelola",
    adminOnly: true,
  },
  {
    href: "/cms/activity",
    label: "Log aktivitas",
    title: "Kelola · Log aktivitas",
    description: "Riwayat tindakan tim beserta tren, bisa diekspor ke CSV.",
    icon: History,
    group: "kelola",
    adminOnly: true,
  },
  {
    href: "/settings",
    label: "Akun & sistem",
    title: "Kelola · Akun & sistem",
    description: "Undang dan atur akun (Pengguna/Admin), batas pemakaian data, dan status sumber.",
    icon: Settings,
    group: "kelola",
    adminOnly: true,
  },
];

/** Item paling spesifik yang cocok (mis. /dokumentasi/oseanografi tidak dianggap /dokumentasi). */
export function findNavItem(pathname: string): NavItem | undefined {
  let best: NavItem | undefined;
  for (const item of NAV_ITEMS) {
    if ((pathname === item.href || pathname.startsWith(`${item.href}/`)) && (!best || item.href.length > best.href.length)) best = item;
  }
  return best;
}
