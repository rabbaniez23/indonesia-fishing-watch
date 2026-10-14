"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/auth/roles";

async function send(url: string, method: "PATCH" | "PUT", body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error?.message ?? "Perubahan gagal disimpan.");
}

/** Kontrol peran & status satu pengguna (tidak ditampilkan untuk akun sendiri). */
export function UserAccessControls({ userId, name, role, status }: { userId: string; name: string; role: Role; status: "active" | "disabled" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(change: { role?: Role; status?: "active" | "disabled" }) {
    setPending(true);
    setError(null);
    try {
      await send(`/api/admin/users/${userId}`, "PATCH", change);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-w-[260px] flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`role-${userId}`}>
          Peran {name}
        </label>
        <select
          id={`role-${userId}`}
          value={role}
          disabled={pending}
          onChange={(e) => apply({ role: e.target.value as Role })}
          className="h-9 rounded-input border border-border-control bg-surface px-2"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <Button
          size="compact"
          variant={status === "active" ? "secondary" : "ghost"}
          disabled={pending}
          onClick={() => apply({ status: status === "active" ? "disabled" : "active" })}
        >
          {status === "active" ? "Nonaktifkan" : "Aktifkan"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-caption text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Form budget request GFW harian. */
export function BudgetForm({ current, min, max }: { current: number; min: number; max: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(new FormData(event.currentTarget).get("budget"));
    setPending(true);
    setMessage(null);
    try {
      await send("/api/admin/settings", "PUT", { gfwDailyBudget: value });
      setMessage({ tone: "success", text: "Budget disimpan." });
      router.refresh();
    } catch (e) {
      setMessage({ tone: "error", text: (e as Error).message });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" aria-label="Budget request GFW harian">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <TextField
          label="Budget request GFW per hari (UTC)"
          name="budget"
          type="number"
          min={min}
          max={max}
          step={1}
          defaultValue={current}
          helper={`${min.toLocaleString("id-ID")}–${max.toLocaleString("id-ID")}; batas provider 50.000/hari per pengguna.`}
          className="sm:w-[320px]"
        />
        <Button type="submit" variant="secondary" loading={pending} loadingLabel="Menyimpan…" className="sm:mb-[26px]">
          Simpan budget
        </Button>
      </div>
      <div aria-live="polite">{message ? <Banner tone={message.tone} title={message.text} /> : null}</div>
    </form>
  );
}
