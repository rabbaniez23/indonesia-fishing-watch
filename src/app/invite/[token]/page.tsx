import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { AuthCard } from "@/components/layout/AuthCard";
import { StateView } from "@/components/ui/StateView";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { findPendingInvite } from "@/lib/auth/service";
import { formatDateTimeUTC } from "@/lib/format";
import { InviteForm } from "./InviteForm";

export const metadata: Metadata = { title: "Aktivasi undangan", referrer: "no-referrer" };

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <AuthCard title="Aktivasi undangan" description="Buat nama tampilan dan kata sandi untuk akun Anda.">
      <Suspense fallback={<div className="h-[300px]" aria-hidden />}>
        <InviteContent params={params} />
      </Suspense>
    </AuthCard>
  );
}

async function InviteContent({ params }: { params: PageProps<"/invite/[token]">["params"] }) {
  const { token } = await params;
  const invite = findPendingInvite(token);
  if (!invite) {
    return (
      <StateView state="unsupported" title="Undangan tidak berlaku">
        <p>Tautan sudah dipakai, dicabut, atau kedaluwarsa. Minta Admin workspace mengirim undangan baru.</p>
        <p className="mt-2">
          <Link href="/login" className="font-medium text-primary underline underline-offset-2">
            Kembali ke halaman masuk
          </Link>
        </p>
      </StateView>
    );
  }
  return (
    <>
      <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-button bg-surface-subtle p-3">
        <dt className="text-ink-muted">Email</dt>
        <dd className="break-all">{invite.email}</dd>
        <dt className="text-ink-muted">Peran</dt>
        <dd>{ROLE_LABELS[invite.role]}</dd>
        <dt className="text-ink-muted">Berlaku sampai</dt>
        <dd>{formatDateTimeUTC(invite.expiresAt)}</dd>
      </dl>
      <InviteForm token={token} />
    </>
  );
}
