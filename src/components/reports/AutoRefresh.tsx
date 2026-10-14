"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Muat ulang data server berkala selama ada laporan yang antre/diproses (status dibaca dari job internal). */
export function AutoRefresh({ active, intervalMs = 4000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, router]);
  return null;
}
