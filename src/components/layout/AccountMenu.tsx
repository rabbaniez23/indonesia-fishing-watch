import { LogOut } from "lucide-react";
import { logoutAction } from "@/lib/auth/actions";
import { ROLE_LABELS } from "@/lib/auth/roles";
import type { SafeUser } from "@/lib/auth/service";

/** Identitas pengguna aktif + tombol keluar di topbar. */
export function AccountMenu({ user }: { user: SafeUser }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-l border-border pl-3">
      <div className="hidden min-w-0 text-right md:block">
        <p className="max-w-[160px] truncate font-medium">{user.name}</p>
        <p className="text-caption text-ink-muted">{ROLE_LABELS[user.role]}</p>
      </div>
      <form action={logoutAction}>
        <button
          type="submit"
          aria-label={`Keluar (${user.name})`}
          title="Keluar"
          className="inline-flex size-11 items-center justify-center rounded-button text-ink-muted hover:bg-surface-subtle hover:text-ink"
        >
          <LogOut className="size-5" aria-hidden />
        </button>
      </form>
    </div>
  );
}
