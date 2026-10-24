import { StateView } from "@/components/ui/StateView";

/** Ditampilkan bila Pengguna non-Admin membuka halaman CMS lewat alamat langsung. */
export function AdminOnly() {
  return (
    <StateView state="unsupported" title="Khusus Admin">
      Halaman CMS hanya dapat dibuka oleh akun Admin.
    </StateView>
  );
}
