"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import {
  PRIORITIES,
  PRIORITY_LABEL,
  TRANSITIONS,
  transitionLabel,
  transitionNeedsReason,
  type FindingPriority,
  type FindingStatus,
} from "@/lib/findings/model";

type Props = { id: string; status: FindingStatus; priority: FindingPriority; version: number; canEdit: boolean };

/** Aksi status/prioritas/catatan. Setiap PATCH membawa `version`; 409 → minta muat ulang (tidak menimpa diam-diam). */
export function FindingActions({ id, status, priority, version, canEdit }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error" | "warning"; text: string } | null>(null);
  const [reopenReason, setReopenReason] = useState("");

  if (!canEdit) {
    return <p className="text-caption text-ink-muted">Peran Viewer hanya dapat membaca temuan; perubahan status dan catatan dilakukan Analyst/Admin.</p>;
  }

  async function send(url: string, method: "PATCH" | "POST", body: unknown, key: string) {
    setPending(key);
    setMessage(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => null);
      if (res.status === 409) {
        setMessage({ tone: "warning", text: data?.error?.message ?? "Temuan sudah diubah pengguna lain." });
        return false;
      }
      if (!res.ok || !data?.ok) {
        setMessage({ tone: "error", text: data?.error?.message ?? "Perubahan gagal disimpan." });
        return false;
      }
      setMessage({ tone: "success", text: "Perubahan disimpan." });
      router.refresh();
      return true;
    } catch {
      setMessage({ tone: "error", text: "Perubahan gagal disimpan. Periksa koneksi." });
      return false;
    } finally {
      setPending(null);
    }
  }

  async function onPriority(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (await send(`/api/findings/${id}`, "PATCH", { version, priority: data.get("priority"), priorityReason: data.get("priorityReason") }, "priority")) form.reset();
  }

  async function onNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (await send(`/api/findings/${id}/notes`, "POST", { body: data.get("body") }, "note")) form.reset();
  }

  return (
    <div className="flex flex-col gap-6">
      <div aria-live="polite">
        {message ? (
          <Banner
            tone={message.tone}
            title={message.text}
            action={
              message.tone === "warning" ? (
                <Button variant="secondary" size="compact" onClick={() => router.refresh()}>
                  Muat ulang
                </Button>
              ) : undefined
            }
          />
        ) : null}
      </div>

      <section aria-labelledby="judul-status" className="flex flex-col gap-3">
        <h3 id="judul-status" className="font-semibold">
          Ubah status
        </h3>
        {TRANSITIONS[status].some((to) => transitionNeedsReason(status, to)) ? (
          <TextAreaField
            label="Alasan membuka kembali"
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            rows={2}
            helper="Wajib diisi untuk membuka kembali temuan yang sudah selesai."
          />
        ) : null}
        <div className="flex flex-wrap gap-2">
          {TRANSITIONS[status].map((to) => (
            <Button
              key={to}
              variant={to === "selesai" || to === "ditinjau" ? "primary" : "secondary"}
              loading={pending === `status-${to}`}
              loadingLabel="Menyimpan…"
              disabled={!!pending}
              onClick={() =>
                send(`/api/findings/${id}`, "PATCH", { version, status: to, statusReason: transitionNeedsReason(status, to) ? reopenReason : undefined }, `status-${to}`)
              }
            >
              {transitionLabel(status, to)}
            </Button>
          ))}
        </div>
      </section>

      <form onSubmit={onPriority} className="flex flex-col gap-3" aria-labelledby="judul-prioritas">
        <h3 id="judul-prioritas" className="font-semibold">
          Ubah prioritas
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-end">
          <SelectField label="Prioritas" name="priority" defaultValue={priority}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </SelectField>
          <TextField label="Alasan perubahan" name="priorityReason" maxLength={1000} />
          <Button type="submit" variant="secondary" loading={pending === "priority"} loadingLabel="Menyimpan…" disabled={!!pending}>
            Simpan prioritas
          </Button>
        </div>
      </form>

      <form onSubmit={onNote} className="flex flex-col gap-3" aria-labelledby="judul-catatan">
        <h3 id="judul-catatan" className="font-semibold">
          Tambah catatan
        </h3>
        <TextAreaField label="Catatan" name="body" rows={3} maxLength={4000} helper="Catatan tidak dapat diubah atau dihapus; koreksi ditulis sebagai catatan baru." />
        <Button type="submit" className="self-start" loading={pending === "note"} loadingLabel="Menyimpan…" disabled={!!pending}>
          Tambah catatan
        </Button>
      </form>
    </div>
  );
}
