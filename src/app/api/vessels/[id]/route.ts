import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { gfwErrorResponse } from "@/lib/api/gfw-errors";
import { apiError, authorize } from "@/lib/api/guard";
import { getVessel, isValidVesselId } from "@/lib/gfw/adapters";
import { summarizeIdentity } from "@/lib/vessels/identity";

/** GET /api/vessels/:id — profil ternormalisasi; nilai kosong tetap null + provenance. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/vessels/[id]">) {
  const auth = authorize(request, "data:read");
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!isValidVesselId(id)) return apiError(400, "INVALID_INPUT", "ID kapal tidak valid.");
  try {
    const result = await getVessel(id);
    return NextResponse.json(
      {
        ok: true,
        data: {
          identity: result.identity,
          summary: summarizeIdentity(result.identity, id),
          datasetResolved: result.datasetResolved,
          fetchedAt: result.fetchedAt,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return gfwErrorResponse(error);
  }
}
