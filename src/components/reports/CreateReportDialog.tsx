"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileDown } from "lucide-react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { SelectField, TextField } from "@/components/ui/Field";
import { MAP_LAYER_KEYS, MAP_LAYERS } from "@/lib/map/layers";
import { REPORT_TYPE_LABEL, REPORT_TYPES, type ReportType } from "@/lib/reports/model";

type Props = {
  canCreate: boolean;
  regions: Array<{ id: string; name: string }>;
  defaults: { regionId: string; from: string; to: string };
  maxDate: string;
  /** Prefill dari URL (mis. tombol "Ekspor kejadian" di profil kapal). */
  initial?: { type?: ReportType; vesselId?: string; from?: string; to?: string; open?: boolean };
};

const KINDS = [
  ["fishing", "Menangkap ikan"],
  ["encounter", "Bertemu kapal lain"],
  ["loitering", "Berhenti di laut"],
  ["port_visit", "Kunjungan pelabuhan"],
] as const;

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Dialog buat laporan (DS §10.7). MVP hanya CSV; PDF tidak ditawarkan karena generatornya belum ada. */
export function CreateReportDialog({ canCreate, regions, defaults, maxDate, initial }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(initial?.open));
  const [type, setType] = useState<ReportType>(initial?.type ?? "ringkasan_harian");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Satu idempotency key per dialog: klik ganda/timeout-retry tidak membuat laporan dobel.
  const [idempotencyKey, setIdempotencyKey] = useState(newKey);

  if (!canCreate) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button disabled icon={<FileDown className="size-4" aria-hidden />}>
          Buat laporan
        </Button>
        <p className="text-caption text-ink-muted">Peran Viewer dapat mengunduh, tetapi tidak membuat laporan.</p>
      </div>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const params: Record<string, unknown> = {
      type,
      regionId: data.get("regionId"),
      from: data.get("from"),
      to: data.get("to"),
    };
    if (type === "sel_grid") params.layer = data.get("layer");
    if (type === "kejadian_kapal") {
      params.vesselId = String(data.get("vesselId") ?? "").trim();
      params.kinds = data.getAll("kinds");
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey, params }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        setError(body?.error?.message ?? "Laporan gagal dibuat.");
        return;
      }
      setOpen(false);
      setIdempotencyKey(newKey());
      router.replace("/reports", { scroll: false });
      router.refresh();
    } catch {
      setError("Laporan gagal dibuat. Periksa koneksi lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button icon={<FileDown className="size-4" aria-hidden />} onClick={() => setOpen(true)}>
        Buat laporan
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Buat laporan"
        description="File dibuat di latar belakang dari data yang sama dengan tampilan. Halaman boleh ditinggalkan."
        size="form"
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {error ? <Banner tone="error" title={error} /> : null}
          <SelectField label="Jenis laporan" value={type} onChange={(e) => setType(e.target.value as ReportType)}>
            {REPORT_TYPES.map((t) => (
              <option key={t} value={t}>
                {REPORT_TYPE_LABEL[t]}
              </option>
            ))}
          </SelectField>
          <SelectField label="Wilayah" name="regionId" defaultValue={defaults.regionId}>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </SelectField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Dari" name="from" type="date" max={maxDate} defaultValue={initial?.from ?? defaults.from} helper="Tanggal UTC" />
            <TextField
              label="Sampai"
              name="to"
              type="date"
              max={maxDate}
              defaultValue={initial?.to ?? defaults.to}
              helper={type === "kunjungan_pelabuhan" ? "Maksimal 31 hari" : "Maksimal 90 hari"}
            />
          </div>
          {type === "sel_grid" ? (
            <SelectField label="Jenis data" name="layer" defaultValue="fishingEffort">
              {MAP_LAYER_KEYS.map((k) => (
                <option key={k} value={k}>
                  {MAP_LAYERS[k].metricLabel}
                </option>
              ))}
            </SelectField>
          ) : null}
          {type === "kejadian_kapal" ? (
            <>
              <TextField label="ID kapal" name="vesselId" defaultValue={initial?.vesselId ?? ""} helper="Lebih mudah: buka profil kapal, lalu klik “Unduh riwayat (CSV)”." />
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 font-medium">Jenis kejadian</legend>
                {KINDS.map(([value, label]) => (
                  <label key={value} className="flex min-h-11 items-center gap-2">
                    <input type="checkbox" name="kinds" value={value} defaultChecked={value !== "port_visit"} className="size-4 accent-[var(--color-primary)]" />
                    {label}
                  </label>
                ))}
              </fieldset>
            </>
          ) : null}
          <p className="text-caption text-ink-muted">
            Format: ZIP berisi <code>data.csv</code> dan <code>metadata.csv</code> (sumber, versi dataset, periode UTC, satuan, kelengkapan,
            caveat). Ekspor PDF belum tersedia (P1).
          </p>
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" loading={pending} loadingLabel="Mengantre…">
              Buat laporan
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
