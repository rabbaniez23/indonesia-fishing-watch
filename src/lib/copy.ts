/**
 * Satu sumber istilah & penjelasan untuk pengguna awam (aman untuk client).
 * Nama utama memakai bahasa sehari-hari; istilah teknis tetap disebut kecil agar tidak menyesatkan
 * (mis. "perkiraan", "bukan jumlah kapal") sesuai batas interpretasi PRD §9 & DS §11.
 */

export type MetricKey = "fishingEffort" | "presence" | "sar";

export const METRIC_COPY: Record<MetricKey, { name: string; short: string; unit: string; term: string; explain: string }> = {
  fishingEffort: {
    name: "Aktivitas penangkapan ikan",
    short: "Penangkapan ikan",
    unit: "jam",
    term: "apparent fishing",
    explain:
      "Perkiraan berapa jam kapal terlihat sedang menangkap ikan, dibaca dari pola gerak sinyal AIS. Ini perkiraan perilaku, bukan jumlah ikan yang ditangkap.",
  },
  presence: {
    name: "Kehadiran kapal",
    short: "Kehadiran kapal",
    unit: "jam",
    term: "vessel presence",
    explain:
      "Total jam kapal yang memancarkan AIS berada di wilayah ini. Satu kapal bisa menyumbang banyak jam, jadi angka ini bukan jumlah kapal.",
  },
  sar: {
    name: "Deteksi radar satelit",
    short: "Radar satelit",
    unit: "deteksi",
    term: "SAR Sentinel-1",
    explain:
      "Kapal yang terlihat di citra radar satelit Sentinel-1, termasuk yang tidak memancarkan AIS. Satu kapal bisa terdeteksi lebih dari sekali, dan jumlahnya ikut dipengaruhi seberapa sering satelit melintas.",
  },
};

export const VESSEL_COUNT_COPY = {
  name: "Jumlah kapal",
  unit: "kapal (ID AIS)",
  explain: "Jumlah identitas kapal AIS yang berbeda selama periode ini. Bisa sedikit berbeda dari jumlah kapal sebenarnya karena satu kapal kadang berganti identitas.",
};

/** Penjelasan singkat istilah yang sering muncul. */
export const GLOSSARY = {
  ais: "AIS adalah sinyal posisi yang dipancarkan kapal. Kapal yang mematikan AIS tidak terlihat di data ini.",
  cell: "Peta dibagi menjadi kotak-kotak kecil sekitar 11 × 11 km (0,1°). Warna kotak menunjukkan seberapa ramai aktivitas di sana — bukan posisi tepat kapal.",
  completeness: "Global Fishing Watch tidak mencantumkan apakah datanya sudah lengkap. Data beberapa hari terakhir bisa masih bertambah.",
  utc: "Semua tanggal memakai waktu UTC (WIB dikurangi 7 jam).",
  gfw: "Data aktivitas berasal dari Global Fishing Watch, lembaga nirlaba yang memantau aktivitas kapal secara global.",
  notViolation: "Data ini menunjukkan aktivitas yang terlihat, bukan bukti pelanggaran.",
} as const;
