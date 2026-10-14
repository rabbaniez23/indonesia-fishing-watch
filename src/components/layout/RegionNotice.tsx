import { Banner } from "@/components/ui/Banner";
import { WPP_OUTSIDE_EEZ, type RegionSummary } from "@/lib/regions";

/** Peringatan bila batas WPP yang dipilih mencakup perairan di luar ZEE Indonesia versi GFW. */
export function RegionNotice({ region }: { region: RegionSummary }) {
  const code = region.type === "wpp" ? region.code.replace("WPP-", "") : null;
  const note = code ? WPP_OUTSIDE_EEZ[code] : undefined;
  if (!note) return null;
  return (
    <Banner tone="warning" title={`Batas ${region.name.split(" · ")[0]} lebih luas dari ZEE Indonesia versi Global Fishing Watch.`}>
      Pada uji 8 Sep–7 Okt 2026, sekitar {note.share}% jam penangkapan ikan di WPP ini berada di luar ZEE tersebut, sebagian besar
      oleh kapal berbendera {note.flags}. Kemungkinan perairan ini termasuk wilayah klaim yang tumpang tindih dengan negara tetangga.
      Angka di bawah mengikuti batas WPP dari file Shapefile.
    </Banner>
  );
}
