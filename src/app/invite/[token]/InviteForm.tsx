"use client";

import { useActionState } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { acceptInviteAction, type FormState } from "@/lib/auth/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-policy";

const initialState: FormState = { error: null };

export function InviteForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(acceptInviteAction.bind(null, token), initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error ? <Banner tone="error" title={state.error} /> : null}
      <TextField label="Nama tampilan" name="name" autoComplete="name" required maxLength={120} />
      <TextField
        label="Kata sandi"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        maxLength={256}
        helper={`Minimal ${MIN_PASSWORD_LENGTH} karakter.`}
      />
      <TextField
        label="Ulangi kata sandi"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        maxLength={256}
      />
      <Button type="submit" loading={pending} loadingLabel="Mengaktifkan…" className="w-full">
        Aktifkan akun
      </Button>
    </form>
  );
}
