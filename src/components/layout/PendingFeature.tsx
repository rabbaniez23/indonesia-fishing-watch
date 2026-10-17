import type { ReactNode } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateView } from "@/components/ui/StateView";
import { PageContainer } from "./PageContainer";

type PendingFeatureProps = {
  title: string;
  description?: ReactNode;
  /** Kalimat jujur mengapa halaman belum menampilkan data. */
  reason: ReactNode;
  /** Gerbang yang harus dipenuhi, ditampilkan sebagai daftar. */
  gates: string[];
};

/**
 * Halaman yang fiturnya belum lolos gate: tidak menampilkan tabel/grafik rekaan,
 * hanya menyebut alasan dan gerbang yang belum terpenuhi (PRD §22).
 */
export function PendingFeature({ title, description, reason, gates }: PendingFeatureProps) {
  return (
    <PageContainer>
      <PageHeader title={title} description={description} />
      <StateView state="gated" title="Belum tersambung ke sumber data">
        <p>{reason}</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-left">
          {gates.map((gate) => (
            <li key={gate}>{gate}</li>
          ))}
        </ul>
        <p className="mt-3">
          Lihat{" "}
          <Link href="/dokumentasi/sumber-data" className="font-medium text-primary underline underline-offset-2">
            Dokumentasi data GFW
          </Link>{" "}
          untuk kondisi akses terkini.
        </p>
      </StateView>
    </PageContainer>
  );
}
