import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { apiError, authorize } from "@/lib/api/guard";
import { recordAudit } from "@/lib/audit";
import { getReport, reportsDir } from "@/lib/reports/service";

const ID_RE = /^[0-9a-f-]{36}$/i;

/**
 * Unduh paket laporan (ZIP: data.csv + metadata.csv). Hanya pengguna login dengan izin unduh;
 * file disajikan dari storage privat lewat server (tidak ada URL publik/bertoken).
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/reports/[id]/download">) {
  const auth = authorize(request, "report:download");
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!ID_RE.test(id)) return apiError(400, "INVALID_INPUT", "ID laporan tidak valid.");
  const report = getReport(id);
  if (!report) return apiError(404, "NOT_FOUND", "Laporan tidak ditemukan.");
  if (report.status !== "siap" || !report.fileName) return apiError(409, "CONFLICT", "Laporan belum siap diunduh.");
  if (report.expired) return apiError(410, "NOT_FOUND", "Masa simpan laporan sudah berakhir. Buat laporan baru.");
  let file: Buffer;
  try {
    file = await readFile(path.join(reportsDir(), `${id}.zip`));
  } catch {
    return apiError(404, "NOT_FOUND", "Berkas laporan tidak ditemukan di penyimpanan.");
  }
  recordAudit({ actorId: auth.user.id, action: "report.download", entityType: "report", entityId: id });
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(file.length),
      "Content-Disposition": `attachment; filename="${report.fileName.replace(/[^\w.-]/g, "_")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
