"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { ROLE_LABELS, ROLES } from "@/lib/auth/roles";

type Result = { kind: "success"; url: string; email: string } | { kind: "error"; message: string } | null;

export function InviteForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setResult(null);
    setCopied(false);
    try {
      const response = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), role: data.get("role") }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) {
        setResult({ kind: "error", message: body?.error?.message ?? "Undangan gagal dibuat." });
        return;
      }
      setResult({ kind: "success", url: body.data.inviteUrl, email: body.data.invite.email });
      form.reset();
      router.refresh();
    } catch {
      setResult({ kind: "error", message: "Undangan gagal dibuat. Periksa koneksi lalu coba lagi." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} className="grid grid-cols-1 items-end gap-4 md:grid-cols-[minmax(0,1fr)_200px_auto]">
        <TextField label="Email" name="email" type="email" required maxLength={254} autoComplete="off" />
        <SelectField label="Peran" name="role" defaultValue="user">
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </SelectField>
        <Button type="submit" loading={pending} loadingLabel="Membuat…">
          Buat undangan
        </Button>
      </form>

      <div aria-live="polite">
        {result?.kind === "error" ? <Banner tone="error" title={result.message} /> : null}
        {result?.kind === "success" ? (
          <Banner
            tone="success"
            title={`Undangan untuk ${result.email} dibuat.`}
            action={
              <Button
                variant="secondary"
                size="compact"
                icon={<Copy className="size-4" aria-hidden />}
                onClick={async () => {
                  await navigator.clipboard.writeText(result.url);
                  setCopied(true);
                }}
              >
                {copied ? "Tersalin" : "Salin tautan"}
              </Button>
            }
          >
            <p className="mt-1 break-all font-mono text-caption">{result.url}</p>
            <p className="mt-1 text-caption text-ink-muted">Tautan ini tidak akan ditampilkan lagi.</p>
          </Banner>
        ) : null}
      </div>
    </div>
  );
}
