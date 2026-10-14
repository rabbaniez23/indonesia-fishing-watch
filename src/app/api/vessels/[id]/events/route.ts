import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { gfwErrorResponse } from "@/lib/api/gfw-errors";
import { apiError, authorize } from "@/lib/api/guard";
import { parseFilter } from "@/lib/analysis/period";
import { EVENT_KINDS, fetchEventsPage, isValidVesselId, type EventKind } from "@/lib/gfw/adapters";
import { getRegion, listRegions, regionArea } from "@/lib/regions";

/**
 * GET /api/vessels/:id/events?kind=fishing|encounter|loitering|port_visit&region=&from=&to=&offset=
 * Kejadian kapal di dalam wilayah tervalidasi (default analisis dibatasi Indonesia, FR-06).
 * Filter `vessels` & pagination nextOffset terbukti lewat contract check (fixture 16–18).
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/vessels/[id]/events">) {
  const auth = authorize(request, "data:read");
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!isValidVesselId(id)) return apiError(400, "INVALID_INPUT", "ID kapal tidak valid.");

  const sp = request.nextUrl.searchParams;
  const kind = sp.get("kind") ?? "fishing";
  if (!(kind in EVENT_KINDS)) return apiError(400, "INVALID_INPUT", "Jenis kejadian tidak dikenal.");
  const offset = Number(sp.get("offset") ?? 0);
  if (!Number.isInteger(offset) || offset < 0 || offset > 10_000) return apiError(400, "INVALID_INPUT", "Offset tidak valid.");

  const regions = listRegions().filter((r) => r.analyzable);
  const { filter, error } = parseFilter(Object.fromEntries(sp.entries()), regions.map((r) => r.id));
  if (error && (sp.has("from") || sp.has("to"))) return apiError(400, "INVALID_RANGE", error);
  const region = getRegion(filter.regionId);
  const area = region ? regionArea(region) : null;
  if (!region || !area) return apiError(400, "INVALID_INPUT", "Wilayah tidak tervalidasi.");

  try {
    const page = await fetchEventsPage({
      kind: kind as EventKind,
      area,
      start: filter.start,
      end: filter.end,
      offset,
      limit: 25,
      vesselIds: [id],
    });
    return NextResponse.json(
      {
        ok: true,
        data: {
          ...page,
          // Hanya kejadian milik kapal ini yang dikembalikan; entri lain (bila ada) dihitung terpisah.
          events: page.events.filter((e) => e.vessel.id === id),
          foreignEntries: page.events.filter((e) => e.vessel.id !== id).length,
          region: { id: region.id, name: region.name },
          period: { from: filter.from, to: filter.to, start: filter.start, end: filter.end },
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    return gfwErrorResponse(err);
  }
}
