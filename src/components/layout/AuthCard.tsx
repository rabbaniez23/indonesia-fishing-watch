import type { ReactNode } from "react";
import { Waves } from "lucide-react";

/** Kerangka halaman publik (login & undangan): kartu terpusat di atas canvas. */
export function AuthCard({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-button bg-primary-soft text-primary">
            <Waves className="size-5" aria-hidden />
          </span>
          <span>
            <span className="block text-card-title font-semibold">Indonesia Fishing Watch</span>
            <span className="block text-caption text-ink-muted">Pilot internal · akses berbasis undangan</span>
          </span>
        </div>
        <section className="glass-strong rounded-card border p-6">
          <h1 className="text-section-title font-semibold">{title}</h1>
          {description ? <div className="mt-1 text-ink-muted">{description}</div> : null}
          <div className="mt-6">{children}</div>
        </section>
        <p className="mt-4 text-caption text-ink-muted">
          Data aktivitas bersumber dari Global Fishing Watch. Produk ini tidak menggantikan sistem pengawasan resmi.
        </p>
      </div>
    </main>
  );
}
