import { GLOSSARY, METRIC_COPY } from "@/lib/copy";

const ITEMS: Array<{ term: string; text: string }> = [
  { term: "Dari mana datanya?", text: GLOSSARY.gfw },
  { term: "Apa itu AIS?", text: GLOSSARY.ais },
  { term: METRIC_COPY.fishingEffort.name, text: METRIC_COPY.fishingEffort.explain },
  { term: METRIC_COPY.presence.name, text: METRIC_COPY.presence.explain },
  { term: METRIC_COPY.sar.name, text: METRIC_COPY.sar.explain },
  { term: "Kotak-kotak di peta", text: GLOSSARY.cell },
  { term: "Seberapa baru datanya?", text: `Data AIS biasanya tersedia sekitar 4 hari setelah kejadian, radar sekitar 5 hari. ${GLOSSARY.utc}` },
  { term: "Apa yang tidak bisa disimpulkan?", text: `${GLOSSARY.notViolation} Kapal yang mematikan AIS juga tidak terlihat, kecuali tertangkap radar satelit.` },
];

/** Panduan membaca data dalam bahasa sehari-hari; tabel teknis tetap ada di bawahnya. */
export function DataGuide() {
  return (
    <section aria-labelledby="judul-panduan" className="glass rounded-card p-4 sm:p-6">
      <h2 id="judul-panduan" className="text-section-title font-semibold">
        Cara membaca data di Indonesia Fishing Watch
      </h2>
      <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
        {ITEMS.map((item) => (
          <div key={item.term}>
            <dt className="font-semibold">{item.term}</dt>
            <dd className="mt-1 text-ink-muted">{item.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
