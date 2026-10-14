"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { loginAction, type FormState } from "@/lib/auth/actions";

const initialState: FormState = { error: null };

export function LoginForm() {
  const next = useSearchParams().get("next") ?? "/overview";
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error ? <Banner tone="error" title={state.error} /> : null}
      <input type="hidden" name="next" value={next} />
      <TextField label="Email" name="email" type="email" autoComplete="username" required maxLength={254} />
      <TextField
        label="Kata sandi"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        maxLength={256}
      />
      <Button type="submit" loading={pending} loadingLabel="Memeriksa…" className="w-full">
        Masuk
      </Button>
    </form>
  );
}
