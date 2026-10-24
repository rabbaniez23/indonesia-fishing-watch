import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, authorize } from "@/lib/api/guard";
import { getCustomLayerGeoJsonContent } from "@/lib/cms/layers";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/cms/layers/[id]/geojson">) {
  const auth = authorize(request, "data:read");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const geojson = getCustomLayerGeoJsonContent(id);
  if (!geojson) return apiError(404, "NOT_FOUND", "Data GeoJSON tidak ditemukan.");

  return new NextResponse(geojson, {
    headers: {
      "Content-Type": "application/geo+json; charset=utf-8",
      "Cache-Control": "private, max-age=60",
    },
  });
}
