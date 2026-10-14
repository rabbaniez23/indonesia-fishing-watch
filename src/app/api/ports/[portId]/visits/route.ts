import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { gfwErrorResponse } from "@/lib/api/gfw-errors";
import { apiError, authorize } from "@/lib/api/guard";
import { parseFilter } from "@/lib/analysis/period";
import { fetchEventsPage } from "@/lib/gfw/adapters";
import { isValidPortId } from "@/lib/ports/ids";
import { PORT_MAX_DAYS } from "@/lib/ports/port-jobs";
import { getRegion, listRegions, regionArea } from "@/lib/regions";

/**
 * GET /api/ports/:portId/visits?region=&from=&to=&offset=
 * Kunjungan yang dimulai dalam periode (START-DATE) ke satu pelabuhan GFW, filter body `portIds` (fixture 29).
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/ports/[portId]/visits">) {
  const auth = authorize(request, "data:read");
  if (!auth.ok) return auth.response;
  const { portId } = await ctx.params;
  if (!isValidPortId(portId)) return apiError(400, "INVALID_INPUT", "ID pelabuhan tidak valid.");
  const sp = request.nextUrl.searchParams;
  const offset = Number(sp.get("offset") ?? 0);
  if (!Number.isInteger(offset) || offset < 0 || offset > 10_000) return apiError(400, "INVALID_INPUT", "Offset tidak valid.");
  const regions = listRegions().filter((r) => r.analyzable);
  const { filter, error } = parseFilter(Object.fromEntries(sp.entries()), regions.map((r) => r.id), new Date(), PORT_MAX_DAYS);
  if (error && (sp.has("from") || sp.has("to"))) return apiError(400, "INVALID_RANGE", error);
  const region = getRegion(filter.regionId);
  const area = region ? regionArea(region) : null;
  if (!region || !area) return apiError(400, "INVALID_INPUT", "Wilayah tidak tervalidasi.");
  try {
    const page = await fetchEventsPage({
      kind: "port_visit",
      area,
      start: filter.start,
      end: filter.end,
      offset,
      limit: 25,
      portIds: [portId],
      timeFilterMode: "START-DATE",
    });
    return NextResponse.json(
      {
        ok: true,
        data: {
          ...page,
          events: page.events.filter((e) => e.portVisit?.startAnchorage?.id === portId),
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
