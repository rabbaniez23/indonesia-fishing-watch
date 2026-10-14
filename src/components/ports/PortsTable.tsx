"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import type { PortSummary } from "@/lib/ports/aggregate";
import { formatCount, formatDateUTC, formatDuration } from "@/lib/format";

type SortKey = "visits" | "vessels" | "duration";

const SORTS: Record<SortKey, { label: string; value: (p: PortSummary) => number }> = {
  visits: { label: "Kunjungan", value: (p) => p.visits },
  vessels: { label: "ID kapal", value: (p) => p.vessels },
  duration: { label: "Durasi median", value: (p) => p.medianDurationHours ?? -1 },
};

/** Tabel referensi pelabuhan dari kunjungan teramati: cari, urutkan, tampilkan bertahap. */
export function PortsTable({ ports, detailQuery }: { ports: PortSummary[]; detailQuery: string }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("visits");
  const [limit, setLimit] = useState(50);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = q
      ? ports.filter((p) => (p.name ?? "").toLowerCase().includes(q) || (p.portId ?? "").toLowerCase().includes(q))
      : ports;
    return [...rows].sort((a, b) => SORTS[sort].value(b) - SORTS[sort].value(a));
  }, [ports, query, sort]);

  const shown = filtered.slice(0, limit);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="port-q" className="font-medium">
            Cari pelabuhan
          </label>
          <input
            id="port-q"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(50);
            }}
            placeholder="Nama atau ID pelabuhan GFW"
            className="h-11 rounded-input border border-border-control bg-surface px-3"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="port-sort" className="font-medium">
            Urutkan
          </label>
          <select
            id="port-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-11 rounded-input border border-border-control bg-surface px-3"
          >
            {Object.entries(SORTS).map(([key, s]) => (
              <option key={key} value={key}>
                {s.label} terbanyak
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-caption text-ink-muted" aria-live="polite">
        {formatCount(filtered.length)} pelabuhan{query ? ` cocok dengan “${query}”` : ""}.
      </p>
      <DataTable
        caption="Daftar pelabuhan"
        rows={shown}
        rowKey={(p) => p.portId ?? "__tanpa_id__"}
        emptyText="Tidak ada pelabuhan yang cocok."
        columns={[
          {
            key: "port",
            header: "Pelabuhan",
            cell: (p) =>
              p.portId ? (
                <div className="min-w-[170px]">
                  <Link href={`/ports/${encodeURIComponent(p.portId)}?${detailQuery}`} className="font-medium text-primary underline underline-offset-2">
                    {p.name ?? "Nama tidak tersedia"}
                  </Link>
                  <p className="font-mono text-caption text-ink-muted">{p.portId}</p>
                </div>
              ) : (
                <span className="text-ink-muted">Tanpa ID pelabuhan</span>
              ),
          },
          { key: "flag", header: "Negara", cell: (p) => p.flag ?? <span className="text-ink-muted">Tidak tersedia</span> },
          { key: "visits", header: "Kunjungan", align: "right", cell: (p) => formatCount(p.visits) },
          { key: "vessels", header: "Kapal", align: "right", cell: (p) => formatCount(p.vessels) },
          { key: "dur", header: "Lama singgah (tengah)", align: "right", cell: (p) => formatDuration(p.medianDurationHours) },
          {
            key: "conf",
            header: "Confidence tinggi",
            align: "right",
            cell: (p) => `${Math.round((p.confidence["4"] / Math.max(1, p.visits)) * 100)}%`,
          },
          { key: "last", header: "Mulai terakhir", cell: (p) => <span className="whitespace-nowrap">{formatDateUTC(p.lastStart)}</span> },
        ]}
      />
      {filtered.length > limit ? (
        <Button variant="secondary" className="self-start" onClick={() => setLimit((l) => l + 50)}>
          Tampilkan 50 lagi · {formatCount(filtered.length - limit)} tersisa
        </Button>
      ) : null}
    </div>
  );
}
