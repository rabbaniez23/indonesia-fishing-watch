import { notFound } from "next/navigation";
import { DesignPreview } from "./DesignPreview";

/**
 * Galeri komponen & state untuk QA visual (DS §15). Hanya tersedia saat development;
 * semua angka di dalamnya berlabel "Contoh" dan bukan hasil pemantauan.
 */
export default function DesignPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignPreview />;
}
