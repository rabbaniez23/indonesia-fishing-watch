import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/layout/AuthCard";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Masuk" };

export default function LoginPage() {
  return (
    <AuthCard title="Masuk" description="Gunakan akun yang dibuat dari undangan workspace. Tidak ada pendaftaran publik.">
      {/* LoginForm membaca ?next= dari URL, jadi dirender saat request. */}
      <Suspense fallback={<div className="h-[244px]" aria-hidden />}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
