/**
 * Label Indonesia untuk kode jenis kapal / alat tangkap GFW. Kode asli tetap ditampilkan (title/teks kecil)
 * agar tidak ada penerjemahan bebas yang mengubah makna; kode tak dikenal ditampilkan apa adanya.
 */
const LABELS: Record<string, string> = {
  FISHING: "Kapal ikan",
  TRAWLERS: "Pukat (trawl)",
  PURSE_SEINES: "Pukat cincin",
  TUNA_PURSE_SEINES: "Pukat cincin tuna",
  OTHER_PURSE_SEINES: "Pukat cincin lain",
  SEINERS: "Pukat",
  OTHER_SEINES: "Pukat lain",
  DRIFTING_LONGLINES: "Rawai hanyut",
  SET_LONGLINES: "Rawai dasar",
  POLE_AND_LINE: "Huhate",
  SQUID_JIGGER: "Pancing cumi",
  SET_GILLNETS: "Jaring insang",
  FIXED_GEAR: "Alat tangkap menetap",
  POTS_AND_TRAPS: "Bubu/perangkap",
  TROLLERS: "Pancing tonda",
  DREDGE_FISHING: "Garuk (dredge)",
  CARRIER: "Kapal pengangkut ikan",
  REEFER: "Kapal pengangkut berpendingin",
  BUNKER: "Kapal pengisi BBM",
  SUPPORT: "Kapal pendukung",
  CARGO: "Kapal kargo",
  TANKER: "Kapal tanker",
  PASSENGER: "Kapal penumpang",
  TUG: "Kapal tunda",
  SEISMIC_VESSEL: "Kapal survei seismik",
  GEAR: "Alat tangkap (pelampung AIS)",
  OTHER: "Lainnya",
  INCONCLUSIVE: "Belum dapat dipastikan",
  DISCREPANCY: "Data tidak konsisten",
};

export function vesselTypeLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return LABELS[code.toUpperCase()] ?? code;
}
