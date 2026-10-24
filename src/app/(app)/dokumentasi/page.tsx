import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { NAV_GROUPS, NAV_ITEMS } from "@/components/layout/nav-items";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateView } from "@/components/ui/StateView";
import { requireUser } from "@/lib/auth/session";
import { formatDateTimeUTC } from "@/lib/format";
import { listArticles } from "@/lib/cms/articles";
import { ARTICLE_CATEGORY_LABELS } from "@/lib/cms/types";
import { oceanMeta } from "@/lib/oseanografi/data";
import { viirsMeta } from "@/lib/viirs/data";
import { longDate, monthLabel } from "@/lib/viirs/format";

export const metadata: Metadata = { title: "Panduan" };

export default function DokumentasiPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Panduan"
        description="Mulai di sini: menu mana untuk keperluan apa, dari mana datanya, dan kapan data diperbarui."
      />
      <Suspense fallback={<StateView state="loading" title="Memuat panduan…" />}>
        <Content />
      </Suspense>
    </PageContainer>
  );
}

type SourceRow = { name: string; used: string; update: string; doc: { href: string; label: string } | null };

const TERMS: Array<[string, string]> = [
  ["WPP", "Wilayah Pengelolaan Perikanan Negara Republik Indonesia; ada 11 WPP laut."],
  ["ZEE", "Zona Ekonomi Eksklusif — laut sampai 200 mil dari garis pangkal tempat Indonesia berhak atas sumber dayanya."],
  ["Jam penangkapan", "Perkiraan GFW berapa jam kapal tampak menangkap ikan, dari pola gerak sinyal AIS-nya."],
  ["Radiansi (VIIRS)", "Kecerahan cahaya yang terekam satelit di malam hari; kapal berlampu terang punya radiansi tinggi."],
  ["Klimatologi", "Rata-rata jangka panjang per bulan kalender, mis. “Agustus rata-rata 2012–2025”."],
];

async function Content() {
  const user = await requireUser();
  // Kelompok "Kelola" (CMS) hanya untuk Admin, sama seperti sidebar.
  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || user.role === "admin");
  const visibleGroups = NAV_GROUPS.filter((group) => visibleItems.some((item) => item.group === group.key));
  const publishedArticles = listArticles({ status: "published" });
  const viirsPeriod = `${monthLabel(viirsMeta.dateRange.start.slice(0, 7))} – ${monthLabel(viirsMeta.dateRange.end.slice(0, 7))}`;
  const sources: SourceRow[] = [
    {
      name: "Global Fishing Watch (API)",
      used: "Ringkasan, Peta, Kapal, Pelabuhan, Statistik aktivitas",
      update:
        "Otomatis. Diambil saat halaman dibuka; hasil disimpan 6 jam (aktivitas & kejadian) atau 24 jam (identitas kapal, batas ZEE). GFW sendiri baru menyediakan data ± 4–5 hari setelah kejadian.",
      doc: { href: "/dokumentasi/sumber-data", label: "Data GFW" },
    },
    {
      name: "VIIRS Boat Detection (EOG)",
      used: "VIIRS kapal malam, lapisan VIIRS di Peta",
      update: `Tetap, ${viirsPeriod}. Diperbarui manual dengan mengolah ulang file data VIIRS.`,
      doc: { href: "/dokumentasi/preprocessing-viirs", label: "Data VIIRS" },
    },
    {
      name: "Copernicus Marine Service",
      used: "Oseanografi, lapisan laut di Peta",
      update: `Tetap, ringkasan dibuat ${longDate(oceanMeta.generatedAt.slice(0, 10))}. Diperbarui manual dengan menjalankan ulang skrip pengolahan.`,
      doc: { href: "/dokumentasi/oseanografi", label: "Data oseanografi" },
    },
    {
      name: "OpenFreeMap / OpenStreetMap",
      used: "Peta dasar (daratan, nama tempat) di semua peta",
      update: "Dimuat langsung dari internet setiap peta dibuka.",
      doc: null,
    },
  ];

  return (
    <>
      <section aria-labelledby="judul-menu" className="flex flex-col gap-3">
        <h2 id="judul-menu" className="text-section-title font-semibold">
          Mau apa? Buka menu ini
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {visibleGroups.map((group) => (
            <Card key={group.key}>
              <CardHeader title={group.label} description={group.description} />
              <ul className="flex flex-col gap-1">
                {visibleItems.filter((item) => item.group === group.key).map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link href={item.href} className="group flex items-start gap-3 rounded-button p-2 hover:bg-surface-subtle">
                        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-button bg-primary-soft text-primary">
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-ink group-hover:text-primary">{item.label}</span>
                          <span className="block text-caption text-ink-muted">{item.description}</span>
                        </span>
                        <ChevronRight className="mt-2 size-4 shrink-0 text-ink-muted" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      <Card>
        <CardHeader
          title="Sumber data & kapan diperbarui"
          description="Hanya data GFW yang ter-update otomatis; VIIRS dan Copernicus adalah ringkasan tetap yang diperbarui manual."
        />
        <DataTable
          caption="Sumber data dan jadwal pembaruan"
          rows={sources}
          rowKey={(r) => r.name}
          columns={[
            { key: "n", header: "Sumber", cell: (r) => <span className="font-medium">{r.name}</span> },
            { key: "u", header: "Dipakai di", cell: (r) => r.used },
            { key: "p", header: "Pembaruan", cell: (r) => <span className="text-caption">{r.update}</span> },
            {
              key: "d",
              header: "Detail",
              cell: (r) =>
                r.doc ? (
                  <Link href={r.doc.href} className="font-medium whitespace-nowrap text-primary underline underline-offset-2">
                    {r.doc.label}
                  </Link>
                ) : (
                  "—"
                ),
            },
          ]}
        />
      </Card>

      {publishedArticles.length > 0 && (
        <Card>
          <CardHeader
            title="Artikel Riset & Panduan Tambahan"
            description="Tulisan analisis berkala, metodologi data, dan catatan edukasi maritim yang diterbitkan oleh peneliti."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {publishedArticles.map((a) => (
              <Link
                key={a.id}
                href={`/dokumentasi/artikel/${a.slug}`}
                className="group flex flex-col justify-between gap-3 rounded-card border border-border bg-neutral-bg/30 p-4 transition-all hover:border-primary hover:bg-surface"
              >
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">{ARTICLE_CATEGORY_LABELS[a.category] || a.category}</Badge>
                    <span className="text-[11px] text-ink-muted">
                      · {a.publishedAt ? formatDateTimeUTC(a.publishedAt).slice(0, 10) : ""}
                    </span>
                  </div>
                  <h3 className="font-semibold text-ink group-hover:text-primary transition-colors">
                    {a.title}
                  </h3>
                  {a.excerpt && (
                    <p className="text-caption text-ink-muted line-clamp-2 leading-relaxed">{a.excerpt}</p>
                  )}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border/50 text-caption text-ink-muted">
                  <span>Oleh {a.author.name}</span>
                  <span className="font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
                    Baca Selengkapnya →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Istilah singkat" />
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[minmax(140px,auto)_1fr]">
          {TERMS.map(([term, def]) => (
            <div key={term} className="contents">
              <dt className="font-semibold text-ink">{term}</dt>
              <dd className="text-ink">{def}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </>
  );
}
