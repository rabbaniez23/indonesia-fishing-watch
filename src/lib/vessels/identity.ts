import type { SelfReportedIdentity, VesselIdentity } from "@/lib/gfw/schemas";

/**
 * Ringkasan identitas kapal (FR-06). Aman untuk client.
 * - Satu entri GFW dapat memuat beberapa identitas AIS (selfReportedInfo) dengan ID & periode berbeda (fixture 07/19).
 * - Entri/kandidat yang berbeda TIDAK digabung walau namanya sama.
 * - Bendera/nama terbaru tidak diterapkan ke seluruh histori; setiap identitas ditampilkan dengan periodenya.
 */

export type TypedValue = { name: string; source: string | null; yearFrom: number | null; yearTo: number | null };

export type IdentitySummary = {
  /** ID yang dipakai untuk profil: identitas yang diminta, atau yang transmisinya paling akhir. */
  primaryId: string;
  primary: SelfReportedIdentity | null;
  /** Identitas AIS lain dalam entri yang sama, terbaru dulu. */
  others: SelfReportedIdentity[];
  shiptypes: TypedValue[];
  geartypes: TypedValue[];
  registryCount: number | null;
  registryShown: number;
  sources: Array<"AIS" | "Registry">;
};

function byLatestTransmission(a: SelfReportedIdentity, b: SelfReportedIdentity) {
  return Date.parse(b.transmissionDateTo ?? "1970-01-01") - Date.parse(a.transmissionDateTo ?? "1970-01-01");
}

export function summarizeIdentity(identity: VesselIdentity, requestedId?: string): IdentitySummary {
  const sorted = [...identity.selfReportedInfo].sort(byLatestTransmission);
  const primary = (requestedId && sorted.find((s) => s.id === requestedId)) || sorted[0] || null;
  const combined =
    identity.combinedSourcesInfo.find((c) => c.vesselId === primary?.id) ?? identity.combinedSourcesInfo[0] ?? null;
  const sources: IdentitySummary["sources"] = [];
  if (identity.selfReportedInfo.length > 0) sources.push("AIS");
  if ((identity.registryInfoTotalRecords ?? 0) > 0 || identity.registryInfo.length > 0) sources.push("Registry");
  return {
    primaryId: primary?.id ?? requestedId ?? "",
    primary,
    others: sorted.filter((s) => s !== primary),
    shiptypes: combined?.shiptypes ?? [],
    geartypes: combined?.geartypes ?? [],
    registryCount: identity.registryInfoTotalRecords,
    registryShown: identity.registryInfo.length,
    sources,
  };
}

/** Label tipe untuk ditampilkan; nilai provider dipertahankan (tidak diterjemahkan secara bebas). */
export function typedLabel(values: TypedValue[]): string | null {
  if (values.length === 0) return null;
  return [...new Set(values.map((v) => v.name))].join(", ");
}
