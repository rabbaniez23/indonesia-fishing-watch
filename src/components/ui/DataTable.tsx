import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";

export type Column<Row> = {
  key: string;
  header: string;
  /** Angka rata kanan; nama/identitas rata kiri (DS §7.5). */
  align?: "left" | "right";
  cell: (row: Row) => ReactNode;
};

type DataTableProps<Row> = {
  caption: string;
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  /** Total baris dari sumber; null → "Total belum diketahui", bukan jumlah page. */
  total?: number | null;
  emptyText?: string;
  className?: string;
};

export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  total,
  emptyText = "Tidak ada baris pada filter ini.",
  className,
}: DataTableProps<Row>) {
  return (
    <div className={cn("min-w-0", className)}>
      {/* Scroll horizontal hanya di dalam container; dapat difokuskan keyboard. */}
      {/* `relative`: elemen absolut (mis. teks sr-only) ikut terpotong kontainer scroll, tidak melebarkan halaman. */}
      <div className="relative overflow-x-auto rounded-button border border-white/70 shadow-[0_0_0_1px_var(--glass-edge)]" tabIndex={0} role="region" aria-label={caption}>
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-primary-soft/70">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn("h-11 px-4 font-medium whitespace-nowrap text-ink-muted", col.align === "right" && "text-right")}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white/55">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-ink-muted">
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={rowKey(row)} className="border-t border-border/70 transition-colors hover:bg-white/70">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn("h-[52px] px-4 py-2 align-middle", col.align === "right" && "tabular text-right font-medium")}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {total !== undefined ? (
        <p className="mt-2 text-caption text-ink-muted">
          {total === null
            ? `Menampilkan ${formatCount(rows.length)} baris · Total belum diketahui`
            : `Menampilkan ${formatCount(rows.length)} dari ${formatCount(total)} baris`}
        </p>
      ) : null}
    </div>
  );
}
