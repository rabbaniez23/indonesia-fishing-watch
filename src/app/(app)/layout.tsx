import { Suspense } from "react";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { AppShell } from "@/components/layout/AppShell";
import { requireUser } from "@/lib/auth/session";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}

/** Sesi diverifikasi di server untuk setiap request; tanpa sesi valid → /login. */
async function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <AppShell isAdmin={user.role === "admin"} account={<AccountMenu user={user} />}>
      {children}
    </AppShell>
  );
}

function ShellFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-busy="true">
      <p className="text-ink-muted">Memeriksa sesi…</p>
    </div>
  );
}
