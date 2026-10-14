"use client";

import { useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { MAX_DAYS, validateFilter } from "@/lib/analysis/period";

type Applied = { regionId: string; from: string; to: string };

type FilterBarProps = {
  regions: Array<{ id: string; name: string }>;
  applied: Applied;
  defaults: Applied;
  /** Hari UTC terakhir yang boleh dipilih (kemarin). */
  maxDate: string;
  /** "stacked" untuk panel sempit (mis. panel layer peta 280px). */
  layout?: "inline" | "stacked";
  /** Batas rentang hari (default 90; pelabuhan 31). */
  maxDays?: number;
};

/**
 * Filter wilayah & periode (FR-02, DS §7.2). Draft terpisah dari filter aktif;
 * analisis baru dijalankan setelah "Terapkan". Filter nonrahasia disimpan di URL.
 */
export function FilterBar({ regions, applied, defaults, maxDate, layout = "inline", maxDays = MAX_DAYS }: FilterBarProps) {
  const stacked = layout === "stacked";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState<Applied>(applied);
  const [error, setError] = useState<string | null>(null);
  // Sinkronkan draft saat filter aktif berubah dari luar (back/forward, tautan).
  const [lastApplied, setLastApplied] = useState(applied);
  if (lastApplied.regionId !== applied.regionId || lastApplied.from !== applied.from || lastApplied.to !== applied.to) {
    setLastApplied(applied);
    setDraft(applied);
    setError(null);
  }

  const dirty = draft.regionId !== applied.regionId || draft.from !== applied.from || draft.to !== applied.to;
  const isDefault = applied.regionId === defaults.regionId && applied.from === defaults.from && applied.to === defaults.to;

  function navigate(next: Applied | null) {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ["region", "from", "to"]) params.delete(key);
    if (next) {
      params.set("region", next.regionId);
      params.set("from", next.from);
      params.set("to", next.to);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = validateFilter(draft, new Date(), maxDays);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    navigate(draft);
  }

  return (
    <form
      onSubmit={onSubmit}
      aria-label="Filter wilayah dan periode"
      className={stacked ? "flex flex-col gap-3" : "flex flex-col gap-3 glass rounded-card p-4"}
      noValidate
    >
      <div
        className={
          stacked
            ? "grid grid-cols-1 gap-3"
            : "grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto]"
        }
      >
        <SelectField
          label="Wilayah"
          value={draft.regionId}
          onChange={(e) => setDraft({ ...draft, regionId: e.target.value })}
          helper={regions.some((r) => r.id.startsWith("wpp-")) ? "Seluruh ZEE Indonesia, atau satu WPP." : undefined}
        >
          {regions.some((r) => r.id.startsWith("wpp-")) ? (
            <>
              <optgroup label="Seluruh perairan">
                {regions
                  .filter((r) => !r.id.startsWith("wpp-"))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Wilayah Pengelolaan Perikanan (WPP)">
                {regions
                  .filter((r) => r.id.startsWith("wpp-"))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </optgroup>
            </>
          ) : (
            regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))
          )}
        </SelectField>
        <TextField
          label="Dari"
          type="date"
          value={draft.from}
          max={maxDate}
          onChange={(e) => setDraft({ ...draft, from: e.target.value })}
          helper="Tanggal UTC"
        />
        <TextField
          label="Sampai"
          type="date"
          value={draft.to}
          max={maxDate}
          onChange={(e) => setDraft({ ...draft, to: e.target.value })}
          helper={`Maksimal ${maxDays} hari`}
        />
        <Button type="submit" className={stacked ? "w-full" : "self-start sm:mt-[26px]"}>
          Terapkan
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={stacked ? "w-full" : "self-start sm:mt-[26px]"}
          icon={<RotateCcw className="size-4" aria-hidden />}
          disabled={isDefault && !dirty}
          onClick={() => {
            setDraft(defaults);
            setError(null);
            navigate(null);
          }}
        >
          Reset
        </Button>
      </div>
      <div aria-live="polite">
        {error ? <Banner tone="error" title={error} /> : null}
        {!error && dirty ? (
          <p className="text-caption font-medium text-warning">Tekan Terapkan untuk memperbarui hasil.</p>
        ) : null}
      </div>
    </form>
  );
}
