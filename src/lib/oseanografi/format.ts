import type { OceanVarKey } from "./types";

/**
 * Tampilan per variabel oseanografi: kelompok, jumlah desimal, ramp warna peta, dan penjelasan singkat untuk belajar.
 * Ramp sekuensial dipakai untuk besaran (satu arah); ramp divergen untuk besaran yang bermakna di sekitar nilai tengah
 * (suhu, tinggi muka laut). Warna peta hanya tampilan — angka pasti ada di tooltip & tabel.
 */

export type OceanGroup = "fisika" | "biologi" | "kimia" | "atmosfer";
export const GROUP_LABEL: Record<OceanGroup, string> = {
  fisika: "Fisika laut",
  biologi: "Biologi (satelit)",
  kimia: "Kimia (model)",
  atmosfer: "Angin & gelombang",
};

type VarStyle = { group: OceanGroup; digits: number; ramp: string[]; short: string; what: string; why: string };

export const VAR_STYLE: Record<OceanVarKey, VarStyle> = {
  sst: {
    group: "fisika",
    digits: 2,
    ramp: ["#313695", "#4575b4", "#74add1", "#abd9e9", "#fee090", "#fdae61", "#f46d43", "#a50026"],
    short: "Suhu",
    what: "Suhu air di lapisan paling atas laut (±0,5 m).",
    why: "Air yang lebih dingin dari biasanya di laut tropis sering menandai upwelling — naiknya air dalam yang kaya nutrien.",
  },
  sss: {
    group: "fisika",
    digits: 2,
    ramp: ["#f7fcf0", "#ccebc5", "#a8ddb5", "#7bccc4", "#4eb3d3", "#2b8cbe", "#08589e"],
    short: "Salinitas",
    what: "Kadar garam air laut permukaan (PSU ≈ gram garam per kilogram air).",
    why: "Salinitas turun karena hujan dan air sungai, naik karena penguapan atau masuknya air samudra yang asin.",
  },
  cur: {
    group: "fisika",
    digits: 2,
    ramp: ["#0d0887", "#5302a3", "#8b0aa5", "#b83289", "#db5c68", "#f48849", "#febd2a", "#f0f921"],
    short: "Arus",
    what: "Kecepatan aliran air di permukaan; panah menunjukkan arah aliran.",
    why: "Arus membawa panas, nutrien, larva, dan sampah; di Indonesia ada Arus Lintas Indonesia (Arlindo) dari Pasifik ke Hindia.",
  },
  ssh: {
    group: "fisika",
    digits: 3,
    ramp: ["#2166ac", "#67a9cf", "#d1e5f0", "#f7f7f7", "#fddbc7", "#ef8a62", "#b2182b"],
    short: "Muka laut",
    what: "Tinggi permukaan laut relatif terhadap bentuk rata-rata bumi (geoid), dalam meter.",
    why: "Perbedaan tinggi muka laut menggerakkan arus, dan muka laut yang turun dapat menandai upwelling.",
  },
  mld: {
    group: "fisika",
    digits: 1,
    ramp: ["#ffffd9", "#c7e9b4", "#7fcdbb", "#41b6c4", "#1d91c0", "#225ea8", "#0c2c84"],
    short: "Lapisan campuran",
    what: "Ketebalan lapisan atas laut yang teraduk merata oleh angin dan gelombang.",
    why: "Lapisan campuran yang dangkal menahan fitoplankton dekat cahaya; yang dalam mengaduk nutrien dari bawah.",
  },
  chl: {
    group: "biologi",
    digits: 3,
    ramp: ["#0b1f5c", "#1f4fb3", "#1f88a8", "#1f9e89", "#35b779", "#6ece58", "#b5de2b", "#fde725"],
    short: "Klorofil",
    what: "Konsentrasi pigmen hijau fitoplankton dari citra satelit warna laut.",
    why: "Fitoplankton adalah dasar rantai makanan: klorofil tinggi berarti makanan bagi zooplankton dan ikan pelagis kecil.",
  },
  pp: {
    group: "biologi",
    digits: 0,
    ramp: ["#fff7ec", "#fee8c8", "#fdd49e", "#fdbb84", "#fc8d59", "#ef6548", "#d7301f", "#990000"],
    short: "Produktivitas",
    what: "Jumlah karbon yang diikat fitoplankton lewat fotosintesis per meter persegi per hari.",
    why: "Menggambarkan seberapa cepat laut \"memproduksi makanan\" — lebih langsung terkait daya dukung perikanan daripada klorofil saja.",
  },
  zsd: {
    group: "biologi",
    digits: 1,
    ramp: ["#8c510a", "#bf812d", "#dfc27d", "#f6e8c3", "#c7eae5", "#80cdc1", "#35978f", "#01665e"],
    short: "Kecerahan",
    what: "Kedalaman Secchi: sedalam apa piringan putih masih terlihat dari permukaan.",
    why: "Air jernih membuat cahaya lampu kapal menembus lebih dalam; air keruh (sedimen, plankton) meredam cahaya.",
  },
  no3: {
    group: "kimia",
    digits: 2,
    ramp: ["#f7fcfd", "#e0ecf4", "#bfd3e6", "#9ebcda", "#8c96c6", "#8c6bb1", "#88419d", "#6e016b"],
    short: "Nitrat",
    what: "Konsentrasi nitrat, salah satu nutrien utama fitoplankton, di permukaan (hasil model).",
    why: "Laut tropis permukaan biasanya miskin nitrat; kenaikan nitrat menandai pengadukan atau upwelling.",
  },
  o2: {
    group: "kimia",
    digits: 1,
    ramp: ["#67001f", "#b2182b", "#d6604d", "#f4a582", "#fddbc7", "#d1e5f0", "#92c5de", "#2166ac"],
    short: "Oksigen",
    what: "Oksigen terlarut di permukaan laut (hasil model).",
    why: "Air hangat menyimpan lebih sedikit oksigen; air upwelling yang dalam juga cenderung rendah oksigen.",
  },
  ph: {
    group: "kimia",
    digits: 3,
    ramp: ["#fde0ef", "#f1b6da", "#de77ae", "#c51b7d", "#8e0152"].reverse(),
    short: "pH",
    what: "Derajat keasaman air laut permukaan (hasil model); laut sedikit basa, sekitar 8,0–8,1.",
    why: "Laut menyerap CO₂ dari udara sehingga pH turun perlahan (pengasaman laut), berdampak pada karang dan kerang.",
  },
  wave: {
    group: "atmosfer",
    digits: 2,
    ramp: ["#f7fbff", "#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#084594"],
    short: "Gelombang",
    what: "Tinggi gelombang signifikan: rata-rata sepertiga gelombang tertinggi (klimatologi model).",
    why: "Gelombang tinggi saat muson membuat nelayan kecil sulit melaut dan menurunkan aktivitas kapal.",
  },
  wind: {
    group: "atmosfer",
    digits: 1,
    ramp: ["#ffffe5", "#fff7bc", "#fee391", "#fec44f", "#fe9929", "#ec7014", "#cc4c02", "#8c2d04"],
    short: "Angin",
    what: "Kecepatan angin 10 m di atas laut; panah menunjukkan arah angin bertiup.",
    why: "Angin muson berbalik arah dua kali setahun dan menggerakkan arus, gelombang, serta upwelling.",
  },
};

export const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const MONTH_LONG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const fmtCache = new Map<number, Intl.NumberFormat>();
function nf(digits: number) {
  if (!fmtCache.has(digits)) fmtCache.set(digits, new Intl.NumberFormat("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits }));
  return fmtCache.get(digits)!;
}

/** Nilai variabel dengan jumlah desimal khasnya. */
export function fmtVar(key: OceanVarKey, v: number | null | undefined, digits = VAR_STYLE[key].digits): string {
  return typeof v === "number" && Number.isFinite(v) ? nf(digits).format(v) : "—";
}

export function fmtNum(v: number | null | undefined, digits = 2): string {
  return typeof v === "number" && Number.isFinite(v) ? nf(digits).format(v) : "—";
}

export function fmtSignedNum(v: number | null | undefined, digits = 2): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  const s = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${s}${nf(digits).format(Math.abs(v))}`;
}

export function fmtP(v: number | null | undefined): string {
  return typeof v === "number" && Number.isFinite(v) ? (v < 0.001 ? "< 0,001" : nf(3).format(v)) : "—";
}

/** "2025-03" → "Mar 2025". */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTH_SHORT[m - 1]} ${y}`;
}

/** Warna dari ramp untuk t ∈ [0, 1] (interpolasi linear antarwarna). */
export function rampColor(ramp: string[], t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t)) * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(x));
  const f = x - i;
  const a = hex(ramp[i]);
  const b = hex(ramp[i + 1]);
  return [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * f)) as [number, number, number];
}

function hex(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Posisi nilai pada skala warna variabel (log untuk klorofil). */
export function scalePos(v: number, vmin: number, vmax: number, log: boolean): number {
  if (log) {
    if (v <= 0) return 0;
    return (Math.log10(v) - Math.log10(vmin)) / (Math.log10(vmax) - Math.log10(vmin));
  }
  return (v - vmin) / (vmax - vmin || 1);
}
