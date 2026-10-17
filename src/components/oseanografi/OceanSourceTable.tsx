import { DataTable } from "@/components/ui/DataTable";
import { VAR_STYLE, monthLabel } from "@/lib/oseanografi/format";
import type { OceanVarKey, OceanVarMeta } from "@/lib/oseanografi/types";

/** Tabel dataset Copernicus Marine per variabel (dipakai di Dokumentasi oseanografi). */
export function OceanSourceTable({ variables }: { variables: OceanVarMeta[] }) {
  return (
    <DataTable
      caption="Sumber dataset oseanografi"
      rows={variables}
      rowKey={(v) => v.key}
      columns={[
        { key: "v", header: "Variabel", cell: (v) => <span className="whitespace-nowrap">{v.label}</span> },
        { key: "u", header: "Satuan", cell: (v) => v.unit || "—" },
        { key: "g", header: "Jenis", cell: (v) => (VAR_STYLE[v.key as OceanVarKey].group === "biologi" ? "Satelit" : v.key === "wind" ? "Satelit + model" : "Model") },
        {
          key: "p",
          header: "Periode",
          cell: (v) =>
            v.kind === "series"
              ? `${monthLabel(v.period.start!)} – ${monthLabel(v.period.end!)}`
              : v.kind === "year"
                ? `${v.period.year} (sampel ${v.period.strideHours} jam)`
                : "Klimatologi bulanan",
        },
        { key: "d", header: "Dataset", cell: (v) => <code className="font-mono text-caption break-all">{v.dataset}</code> },
      ]}
    />
  );
}
