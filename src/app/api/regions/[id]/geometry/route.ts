import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, authorize } from "@/lib/api/guard";
import { getRegion, getRegionGeoJson } from "@/lib/regions";

/** Geometri wilayah tervalidasi (GeoJSON EPSG:4326) untuk garis batas di peta. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/regions/[id]/geometry">) {
  const auth = authorize(request, "data:read");
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const region = getRegion(id);
  const geojson = region ? getRegionGeoJson(id) : null;
  if (!region || !geojson) return apiError(404, "NOT_FOUND", "Wilayah tidak ditemukan.");
  return NextResponse.json(geojson, {
    headers: { "Cache-Control": "private, max-age=3600", ETag: `"${region.geometryHash}"` },
  });
}
