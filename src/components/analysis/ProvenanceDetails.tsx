import type { ReportResultMeta } from "@/lib/analysis/report-jobs";
import { formatCount, formatDateTimeUTC, formatDateUTC } from "@/lib/format";

const COMPLETENESS: Record<ReportResultMeta["provenance"]["completeness"], string> = {
  complete: "Lengkap",
  partial: "Sebagian",
  unknown: "Belum diketahui",
};

/** Jalur melihat provenance setiap kartu data (FR-11): sumber, versi, waktu, kelengkapan, peringatan. */
export function ProvenanceDetails({
  provenance: p,
  summary = "Sumber & waktu",
}: {
  provenance: ReportResultMeta["provenance"];
  summary?: string;
}) {
  const latest = p.latestObservationAt
    ? p.latestObservationAt.length === 10
      ? `${formatDateUTC(p.latestObservationAt)} (hari UTC)`
      : formatDateTimeUTC(p.latestObservationAt)
    : "Tidak tersedia pada hasil ini";
  return (
    <details className="group w-full text-caption">
      <summary className="cursor-pointer list-none font-medium text-primary underline underline-offset-2 marker:hidden">
        {summary}
      </summary>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-input bg-surface-subtle p-3 text-ink">
        <dt className="text-ink-muted">Sumber</dt>
        <dd>Global Fishing Watch · {p.datasetResolved ?? p.datasetRequested}</dd>
        <dt className="text-ink-muted">Diambil pada</dt>
        <dd>{formatDateTimeUTC(p.fetchedAt)}</dd>
        <dt className="text-ink-muted">Observasi terakhir dalam hasil</dt>
        <dd>{latest}</dd>
        <dt className="text-ink-muted">Data tersedia sampai</dt>
        <dd>{p.providerAvailableThrough ? formatDateUTC(p.providerAvailableThrough) : "Belum diketahui"}</dd>
        <dt className="text-ink-muted">Kelengkapan</dt>
        <dd>{COMPLETENESS[p.completeness]}</dd>
        <dt className="text-ink-muted">Agregasi</dt>
        <dd className="break-words">
          {p.aggregation}
          {p.spatialResolution ? ` · ${p.spatialResolution}` : ""} · {formatCount(p.rowCount)} baris
        </dd>
        {p.warnings.length > 0 ? (
          <>
            <dt className="text-ink-muted">Catatan</dt>
            <dd>
              <ul className="list-disc pl-4">
                {p.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </dd>
          </>
        ) : null}
      </dl>
    </details>
  );
}
