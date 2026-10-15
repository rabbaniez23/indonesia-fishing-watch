import Link from "next/link";
import type { ReactNode } from "react";
import { MONTH_LONG, VAR_STYLE, fmtNum, fmtP, fmtSignedNum, fmtVar } from "@/lib/oseanografi/format";
import type { OceanLink, OceanSeasonal, OceanTrends, OceanVarKey, OceanVarMeta } from "@/lib/oseanografi/types";

/**
 * Materi belajar oseanografi. Teks konsep bersifat umum; kalimat "Dalam data ini" dihitung dari ringkasan Copernicus
 * Marine sehingga selalu sesuai angka yang ditampilkan di tab lain.
 */

type Props = {
  variables: OceanVarMeta[];
  seasonal: OceanSeasonal;
  trends: OceanTrends;
  link: OceanLink;
  wppNames: Record<string, string>;
};

const month = (m: number | null | undefined) => (m ? MONTH_LONG[m - 1] : "—");

function Concept({ title, children, facts, links }: { title: string; children: ReactNode; facts: ReactNode[]; links: Array<[string, string]> }) {
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-card border border-border bg-white/60 p-4 sm:p-5">
      <h3 className="text-card-title font-semibold text-ink">{title}</h3>
      <div className="flex flex-col gap-2 text-ink">{children}</div>
      {facts.length ? (
        <div className="rounded-button bg-primary-soft/70 p-3">
          <p className="mb-1 text-caption font-semibold text-primary">Dalam data ini</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-caption text-ink">
            {facts.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-caption">
        {links.map(([href, label]) => (
          <Link key={href} href={href} className="font-medium text-primary underline underline-offset-2">
            {label}
          </Link>
        ))}
      </p>
    </article>
  );
}

export function LearnSection({ variables, seasonal, trends, link, wppNames }: Props) {
  const has = (k: OceanVarKey) => variables.some((v) => v.key === k);
  const unit = (k: OceanVarKey) => variables.find((v) => v.key === k)?.unit ?? "";
  const s = (k: OceanVarKey, a: string) => seasonal[k]?.[a];
  const w = (code: string) => `WPP ${code}${wppNames[code] ? ` (${wppNames[code]})` : ""}`;
  const areas = Object.keys(wppNames);

  const extreme = (k: OceanVarKey, fn: (a: number, b: number) => boolean) => {
    let best: { a: string; v: number } | null = null;
    for (const a of areas) {
      const vals = (s(k, a)?.mean ?? []).filter((x): x is number => x !== null);
      if (!vals.length) continue;
      const v = vals.reduce((x, y) => x + y, 0) / vals.length;
      if (!best || fn(v, best.v)) best = { a, v };
    }
    return best;
  };

  const sstT = trends.sst?.total;
  const chlT = trends.chl?.total;
  const phT = trends.ph?.total;
  const sstYears = trends.sst?.years ?? [];
  const chlYears = trends.chl?.years ?? [];
  const phYears = trends.ph?.years ?? [];
  const lowSss = has("sss") ? extreme("sss", (a, b) => a < b) : null;
  const highSss = has("sss") ? extreme("sss", (a, b) => a > b) : null;
  const clear = has("zsd") ? extreme("zsd", (a, b) => a > b) : null;
  const murky = has("zsd") ? extreme("zsd", (a, b) => a < b) : null;
  const fastCur = has("cur") ? extreme("cur", (a, b) => a > b) : null;
  const strongest = variables
    .map((v) => ({ v, r: link.vars[v.key]?.total?.season.r ?? null }))
    .filter((x) => x.r !== null)
    .sort((a, b) => Math.abs(b.r!) - Math.abs(a.r!))[0];

  const upwelling = ["573", "714", "718"].filter((a) => s("sst", a) && s("chl", a));

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Concept
        title="1. Muson: mesin musim di laut Indonesia"
        facts={[
          has("wind") ? (
            <>
              Angin rata-rata 11 WPP paling kencang pada {month(s("wind", "total")?.peak)} dan paling lemah pada {month(s("wind", "total")?.low)} (tahun{" "}
              {variables.find((v) => v.key === "wind")?.period.year}).
            </>
          ) : null,
          has("wave") ? (
            <>
              Gelombang rata-rata paling tinggi pada {month(s("wave", "total")?.peak)} ({fmtVar("wave", s("wave", "total")?.mean[(s("wave", "total")?.peak ?? 1) - 1])} m) dan paling
              rendah pada {month(s("wave", "total")?.low)}.
            </>
          ) : null,
        ].filter(Boolean)}
        links={[
          ["/oseanografi?tab=peta&var=wind", "Lihat peta angin per bulan"],
          ["/oseanografi?tab=peta&var=wave", "Peta gelombang"],
        ]}
      >
        <p>
          Indonesia berada di antara benua Asia dan Australia. Sekitar Desember–Februari bertiup <strong>muson barat</strong> (angin dari barat laut, musim hujan);
          sekitar Juni–September bertiup <strong>muson timur</strong> (angin dari tenggara yang kering). Pembalikan arah angin ini mengubah arus, gelombang, suhu,
          dan kesuburan laut sepanjang tahun.
        </p>
        <p>Putar peta angin 12 bulan dan perhatikan arah panah berbalik antara awal dan pertengahan tahun.</p>
      </Concept>

      <Concept
        title="2. Upwelling: air dingin yang menyuburkan"
        facts={upwelling.map((a) => (
          <>
            {w(a)}: suhu terendah pada {month(s("sst", a)?.low)}, klorofil tertinggi pada {month(s("chl", a)?.peak)}
            {s("no3", a) ? <>, nitrat tertinggi pada {month(s("no3", a)?.peak)}</> : null}.
          </>
        ))}
        links={[
          ["/oseanografi?tab=peta&var=sst", "Peta suhu"],
          ["/oseanografi?tab=peta&var=chl", "Peta klorofil"],
          ["/oseanografi?tab=musiman", "Pola musiman per WPP"],
        ]}
      >
        <p>
          Saat angin menyeret air permukaan menjauh dari pantai atau memisahkan arus, air dari lapisan dalam naik ke atas — disebut <strong>upwelling</strong>. Air
          dalam itu lebih <strong>dingin</strong> dan kaya <strong>nutrien</strong> (nitrat, fosfat), sehingga fitoplankton tumbuh pesat dan <strong>klorofil</strong> naik.
        </p>
        <p>
          Tanda upwelling di data: suhu turun, nitrat naik, lalu klorofil naik — di Indonesia biasanya saat muson timur di selatan Jawa–Nusa Tenggara, Laut
          Banda, dan Laut Arafura.
        </p>
      </Concept>

      <Concept
        title="3. Fitoplankton, klorofil, dan rantai makanan"
        facts={[
          has("chl") ? (
            <>
              Klorofil rata-rata 11 WPP tertinggi pada {month(s("chl", "total")?.peak)} dan terendah pada {month(s("chl", "total")?.low)}.
            </>
          ) : null,
          chlT?.senPerDecade != null ? (
            <>
              Tren klorofil tahunan {chlYears[0]}–{chlYears[chlYears.length - 1]}: {fmtSignedNum(chlT.senPerDecade, 3)} {unit("chl")} per dekade (p {fmtP(chlT.p)}
              {chlT.significant ? ", signifikan" : ", tidak signifikan"}).
            </>
          ) : null,
          has("pp") ? (
            <>
              Produktivitas primer tertinggi pada {month(s("pp", "total")?.peak)} ({fmtVar("pp", s("pp", "total")?.mean[(s("pp", "total")?.peak ?? 1) - 1])} {unit("pp")}).
            </>
          ) : null,
        ].filter(Boolean)}
        links={[
          ["/oseanografi?tab=peta&var=chl", "Peta klorofil"],
          ["/oseanografi?tab=peta&var=pp", "Peta produktivitas primer"],
        ]}
      >
        <p>
          <strong>Fitoplankton</strong> adalah tumbuhan mikroskopis di laut. Pigmen hijaunya (klorofil-a) terlihat oleh satelit sebagai perubahan warna laut.
          Fitoplankton dimakan zooplankton, yang dimakan ikan pelagis kecil (teri, lemuru, layang), yang dimakan ikan besar.
        </p>
        <p>
          Klorofil menunjukkan <em>berapa banyak</em> fitoplankton; <strong>produktivitas primer</strong> menunjukkan <em>seberapa cepat</em> karbon diikat — keduanya
          dipakai untuk memperkirakan daerah yang subur bagi perikanan.
        </p>
      </Concept>

      <Concept
        title="4. Suhu laut dan pemanasan"
        facts={[
          has("sst") ? (
            <>
              Suhu rata-rata 11 WPP paling hangat pada {month(s("sst", "total")?.peak)} ({fmtVar("sst", s("sst", "total")?.mean[(s("sst", "total")?.peak ?? 1) - 1])} °C) dan
              paling sejuk pada {month(s("sst", "total")?.low)} ({fmtVar("sst", s("sst", "total")?.mean[(s("sst", "total")?.low ?? 1) - 1])} °C).
            </>
          ) : null,
          sstT?.senPerDecade != null ? (
            <>
              Tren suhu tahunan {sstYears[0]}–{sstYears[sstYears.length - 1]}: {fmtSignedNum(sstT.senPerDecade, 2)} °C per dekade (p {fmtP(sstT.p)}
              {sstT.significant ? ", signifikan" : ", tidak signifikan"}).
            </>
          ) : null,
        ].filter(Boolean)}
        links={[
          ["/oseanografi?tab=tren", "Tren per WPP"],
          ["/oseanografi?tab=peta&var=sst", "Peta suhu"],
        ]}
      >
        <p>
          Perairan Indonesia termasuk <strong>kolam air hangat</strong> (Indo-Pacific Warm Pool), salah satu laut terhangat di dunia, yang memengaruhi hujan dan iklim
          global. Suhu laut naik perlahan seiring pemanasan global; kenaikan kecil per dekade dapat menggeser lokasi ikan dan memicu pemutihan karang.
        </p>
      </Concept>

      <Concept
        title="5. Arus Lintas Indonesia (Arlindo)"
        facts={[
          fastCur ? (
            <>
              Arus permukaan rata-rata paling kencang di {w(fastCur.a)}: {fmtVar("cur", fastCur.v)} m/s.
            </>
          ) : null,
          s("cur", "713") ? (
            <>
              WPP 713 (Selat Makassar, jalur utama Arlindo): arus paling kencang pada {month(s("cur", "713")?.peak)}.
            </>
          ) : null,
        ].filter(Boolean)}
        links={[["/oseanografi?tab=peta&var=cur", "Peta arus dengan panah arah"]]}
      >
        <p>
          Air dari Samudra Pasifik mengalir ke Samudra Hindia melewati celah-celah kepulauan Indonesia — terutama Selat Makassar, lalu Laut Flores–Banda, dan keluar
          lewat Selat Lombok, Selat Ombai, dan Laut Timor. Aliran ini disebut <strong>Arlindo</strong> (Indonesian Throughflow) dan memindahkan panas serta garam
          antarsamudra.
        </p>
        <p>Arus permukaan juga dipengaruhi muson, sehingga arahnya di laut dangkal seperti Laut Jawa dapat berbalik antarmusim.</p>
      </Concept>

      <Concept
        title="6. Salinitas: jejak hujan dan sungai"
        facts={[
          lowSss ? (
            <>
              Rata-rata paling tawar: {w(lowSss.a)} ({fmtVar("sss", lowSss.v)} PSU); paling asin: {highSss ? w(highSss.a) : "—"} ({fmtVar("sss", highSss?.v)} PSU).
            </>
          ) : null,
        ].filter(Boolean)}
        links={[["/oseanografi?tab=peta&var=sss", "Peta salinitas"]]}
      >
        <p>
          Air laut rata-rata mengandung sekitar 35 gram garam per kilogram (35 PSU). Di dekat muara sungai besar dan di laut yang banyak hujan, salinitas turun;
          di laut yang terhubung samudra atau saat musim kemarau, salinitas cenderung lebih tinggi. Salinitas bersama suhu menentukan kerapatan air dan pola arus.
        </p>
      </Concept>

      <Concept
        title="7. Kecerahan air dan lampu kapal"
        facts={[
          clear && murky ? (
            <>
              Air paling jernih rata-rata di {w(clear.a)} (Secchi {fmtVar("zsd", clear.v)} m); paling keruh di {w(murky.a)} ({fmtVar("zsd", murky.v)} m).
            </>
          ) : null,
        ].filter(Boolean)}
        links={[
          ["/oseanografi?tab=peta&var=zsd", "Peta kecerahan air"],
          ["/viirs", "Deteksi kapal malam (VIIRS)"],
        ]}
      >
        <p>
          <strong>Kedalaman Secchi</strong> mengukur seberapa dalam cahaya menembus air. Kapal bagan dan purse seine memakai lampu untuk mengumpulkan ikan dan cumi;
          di air jernih cahaya menembus lebih dalam, sedangkan sedimen sungai atau plankton yang padat meredamnya. Ini salah satu alasan pola deteksi lampu kapal
          berbeda antarwilayah.
        </p>
      </Concept>

      <Concept
        title="8. Kimia laut: nitrat, oksigen, dan pH"
        facts={[
          phT?.senPerDecade != null ? (
            <>
              Tren pH rata-rata 11 WPP {phYears[0]}–{phYears[phYears.length - 1]}: {fmtSignedNum(phT.senPerDecade, 3)} per dekade (p {fmtP(phT.p)}
              {phT.significant ? ", signifikan" : ", tidak signifikan"}).
            </>
          ) : null,
          has("o2") ? <>Oksigen permukaan rata-rata tertinggi pada {month(s("o2", "total")?.peak)} dan terendah pada {month(s("o2", "total")?.low)}.</> : null,
        ].filter(Boolean)}
        links={[
          ["/oseanografi?tab=peta&var=no3", "Peta nitrat"],
          ["/oseanografi?tab=peta&var=ph", "Peta pH"],
        ]}
      >
        <p>
          <strong>Nitrat</strong> adalah &quot;pupuk&quot; fitoplankton. <strong>Oksigen</strong> terlarut lebih sedikit di air hangat. <strong>pH</strong> laut sedikit basa
          (sekitar 8,0–8,1) dan turun perlahan karena laut menyerap CO₂ dari atmosfer — disebut pengasaman laut. Ketiganya di sini berasal dari model biogeokimia,
          bukan pengukuran langsung, jadi cocok untuk melihat pola, bukan nilai pasti di satu titik.
        </p>
      </Concept>

      <Concept
        title="9. Menghubungkan laut dengan aktivitas kapal"
        facts={[
          strongest ? (
            <>
              Untuk 11 WPP gabungan, pola musiman yang paling kuat berkaitan dengan deteksi kapal malam adalah {strongest.v.label.toLowerCase()} (r ={" "}
              {fmtSignedNum(strongest.r, 2)}
              {strongest.r! < 0
                ? `; arahnya berlawanan — saat ${strongest.v.label.toLowerCase()} rendah, deteksi kapal cenderung tinggi`
                : "; naik-turunnya searah"}
              ).
            </>
          ) : null,
        ].filter(Boolean)}
        links={[["/oseanografi?tab=kapal", "Bandingkan dengan deteksi kapal"]]}
      >
        <p>
          Paper VIIRS menyebut puncak aktivitas kapal malam di banyak WPP terjadi Agustus–Oktober, saat muson timur memicu upwelling dan klorofil naik, dan
          aktivitas turun saat gelombang tinggi muson barat. Tab <em>Laut &amp; kapal</em> menguji gagasan itu dengan data: apakah naik-turunnya variabel laut
          sejalan dengan jumlah deteksi kapal?
        </p>
        <p className="text-caption text-ink-muted">
          Ingat: korelasi bukan sebab-akibat. Nelayan juga dipengaruhi harga, BBM, cuaca harian, aturan, dan hari raya. {VAR_STYLE.chl.why}
        </p>
      </Concept>

      <p className="text-caption text-ink-muted xl:col-span-2">
        Satuan: suhu dalam °C, salinitas dalam PSU, klorofil dalam mg/m³, produktivitas primer dalam mg C/m²/hari. Angka &quot;dalam data ini&quot; dihitung dari
        rata-rata area 11 WPP; nilai di satu lokasi dapat jauh berbeda. Format angka: {fmtNum(1234.5, 1)} = seribu dua ratus tiga puluh empat koma lima.
      </p>
    </div>
  );
}
