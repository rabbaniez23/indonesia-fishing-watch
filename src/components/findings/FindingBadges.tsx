import { Badge, type StatusTone } from "@/components/ui/Badge";
import { PRIORITY_LABEL, STATUS_LABEL, type FindingPriority, type FindingStatus } from "@/lib/findings/model";

/**
 * Status peninjauan: "Selesai" sengaja netral (bukan hijau sukses) agar tidak terbaca sebagai "kapal legal" (DS §3.2).
 * Prioritas tinggi amber + teks; bukan merah/ilegal (DS §10.6).
 */
const STATUS_TONE: Record<FindingStatus, StatusTone> = {
  baru: "info",
  ditinjau: "neutral",
  perlu_informasi: "warning",
  selesai: "neutral",
};

const PRIORITY_TONE: Record<FindingPriority, StatusTone> = { rendah: "neutral", sedang: "neutral", tinggi: "warning" };

export function FindingStatusBadge({ status }: { status: FindingStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function FindingPriorityBadge({ priority }: { priority: FindingPriority }) {
  return <Badge tone={PRIORITY_TONE[priority]}>Prioritas {PRIORITY_LABEL[priority].toLowerCase()}</Badge>;
}
