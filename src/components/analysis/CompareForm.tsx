"use client";

import { useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";

/** Pilih awal periode pembanding; panjang mengikuti periode aktif (definisi & resolusi identik). */
export function CompareForm({ current, days, maxDate }: { current: string; days: number; maxDate: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(current);

  function go(cmpFrom: string | null) {
    const next = new URLSearchParams(params.toString());
    if (cmpFrom) next.set("cmpFrom", cmpFrom);
    else next.delete("cmpFrom");
    router.push(`${pathname}?${next}`, { scroll: false });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    go(value || null);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end" aria-label="Periode pembanding">
      <TextField
        label="Mulai periode pembanding"
        type="date"
        value={value}
        max={maxDate}
        onChange={(e) => setValue(e.target.value)}
        helper={`Panjang otomatis ${days} hari (sama dengan periode aktif); tidak boleh tumpang tindih.`}
        className="sm:min-w-[260px]"
      />
      <Button type="submit" variant="secondary" className="sm:mb-[26px]">
        Terapkan pembanding
      </Button>
      <Button variant="ghost" className="sm:mb-[26px]" onClick={() => go(null)}>
        Periode sebelumnya
      </Button>
    </form>
  );
}
