import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, authorize } from "@/lib/api/guard";
import { getCellDetail, getMapCells } from "@/lib/map/cells";

/**
 * GET /api/map/cells/:resultId              → seluruh sel snapshot (ringkas) + kelas kuantil + provenance
 * GET /api/map/cells/:resultId?lat=..&lon=.. → detail satu sel (rincian bendera, batas sel, peringkat)
 * Snapshot immutable → boleh di-cache privat di browser.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/map/cells/[resultId]">) {
  const auth = authorize(request, "data:read");
  if (!auth.ok) return auth.response;
  const { resultId } = await ctx.params;
  const headers = { "Cache-Control": "private, max-age=3600, immutable" };

  const latParam = request.nextUrl.searchParams.get("lat");
  const lonParam = request.nextUrl.searchParams.get("lon");
  if (latParam !== null || lonParam !== null) {
    const lat = Number(latParam);
    const lon = Number(lonParam);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return apiError(400, "INVALID_INPUT", "Koordinat sel tidak valid.");
    }
    const detail = getCellDetail(resultId, lat, lon);
    if (!detail) return apiError(404, "NOT_FOUND", "Sel tidak ditemukan pada snapshot ini.");
    return NextResponse.json({ ok: true, data: detail }, { headers });
  }

  const cells = getMapCells(resultId);
  if (!cells) return apiError(404, "NOT_FOUND", "Snapshot sel tidak ditemukan.");
  return NextResponse.json({ ok: true, data: cells }, { headers });
}
