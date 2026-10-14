"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import { Banner } from "@/components/ui/Banner";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { formatDateRangeUTC, formatDateTimeUTC, formatLatLon } from "@/lib/format";
import { PRIORITIES, PRIORITY_LABEL, sourceLabel, type FilterSnapshot, type FindingSource } from "@/lib/findings/model";

type SaveFindingButtonProps = {
  source: FindingSource;
  filter: FilterSnapshot;
  canCreate: boolean;
  defaultTitle?: string;
  label?: string;
  variant?: ButtonVariant;
  size?: "default" | "compact";
};

/**
 * Simpan sel/kapal/kejadian sebagai temuan (FR-09). Snapshot sumber & filter dikirim apa adanya dan disimpan
 * immutable. Viewer melihat tombol nonaktif dengan alasan (bukan tombol yang tampak aktif).
 */
export function SaveFindingButton({ source, filter, canCreate, defaultTitle = "", label = "Simpan temuan", variant = "secondary", size = "default" }: SaveFindingButtonProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string; title: string } | null>(null);

  if (!canCreate) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Button variant={variant} size={size} disabled>
          {label}
        </Button>
        <p className="text-caption text-ink-muted">Peran Viewer hanya dapat membaca temuan.</p>
      </div>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/findings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.get("title"),
          reason: data.get("reason"),
          priority: data.get("priority"),
          priorityReason: data.get("priorityReason"),
          source,
          filter,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        setError(body?.error?.message ?? "Temuan gagal disimpan.");
        return;
      }
      setSaved({ id: body.data.id, title: body.data.title });
      setOpen(false);
    } catch {
      setError("Temuan gagal disimpan. Periksa koneksi lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant={variant} size={size} icon={<Bookmark className="size-4" aria-hidden />} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <div aria-live="polite">
        {saved ? (
          <p className="text-caption text-ink">
            Temuan disimpan.{" "}
            <Link href={`/findings/${saved.id}`} className="font-medium text-primary underline underline-offset-2">
              Lihat temuan
            </Link>
          </p>
        ) : null}
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Simpan temuan"
        description="Temuan adalah catatan peninjauan internal; bukan penetapan pelanggaran."
        size="form"
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <SourcePreview source={source} filter={filter} />
          {error ? <Banner tone="error" title={error} /> : null}
          <TextField label="Judul" name="title" required minLength={3} maxLength={160} defaultValue={defaultTitle} />
          <TextAreaField
            label="Alasan"
            name="reason"
            required
            minLength={10}
            maxLength={4000}
            helper="Mengapa perlu ditinjau? Tuliskan fakta yang terlihat, bukan kesimpulan pelanggaran."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
            <SelectField label="Prioritas" name="priority" defaultValue="sedang">
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </SelectField>
            <TextField label="Alasan prioritas" name="priorityReason" required minLength={5} maxLength={1000} helper="Ditetapkan pengguna; bukan probabilitas ilegal." />
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" loading={pending} loadingLabel="Menyimpan…">
              Simpan temuan
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

export function SourcePreview({ source, filter }: { source: FindingSource; filter: FilterSnapshot }) {
  let detail: string;
  switch (source.type) {
    case "cell":
      detail = `${formatLatLon(source.lat, source.lon)} · ${source.value.toLocaleString("id-ID")} ${source.unit}`;
      break;
    case "vessel":
      detail = `${source.name ?? "Nama tidak tersedia"} · MMSI ${source.mmsi ?? "—"} · ${source.flag ?? "bendera tidak diketahui"}`;
      break;
    case "event":
      detail = `${source.eventType} · ${source.vesselName ?? "kapal"} · ${formatDateTimeUTC(source.start)}`;
      break;
    default:
      detail = "Tanpa sumber data terkait";
  }
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-input bg-surface-subtle p-3 text-caption">
      <dt className="text-ink-muted">Sumber</dt>
      <dd>{sourceLabel(source)}</dd>
      <dt className="text-ink-muted">Rincian</dt>
      <dd className="break-words">{detail}</dd>
      <dt className="text-ink-muted">Konteks filter</dt>
      <dd>{formatDateRangeUTC(filter.from, filter.to)}</dd>
      {"datasetResolved" in source && source.datasetResolved ? (
        <>
          <dt className="text-ink-muted">Dataset</dt>
          <dd className="break-all">{source.datasetResolved}</dd>
        </>
      ) : null}
    </dl>
  );
}
