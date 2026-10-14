import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import density from "@/data/viirs/density.json";
import monthlyGrid from "@/data/viirs/monthly-grid-2025.json";
import { apiError, authorize } from "@/lib/api/guard";
import { viirsMeta } from "@/lib/viirs/data";

/** Grid peta VIIRS (statis, dibangun offline) — terlalu besar untuk ikut payload halaman. */
const DATASETS: Record<string, unknown> = { density, "monthly-grid-2025": monthlyGrid };

export async function GET(request: NextRequest, ctx: RouteContext<"/api/viirs/[dataset]">) {
  const auth = authorize(request, "data:read");
  if (!auth.ok) return auth.response;
  const { dataset } = await ctx.params;
  const body = Object.hasOwn(DATASETS, dataset) ? DATASETS[dataset] : null;
  if (!body) return apiError(404, "NOT_FOUND", "Data VIIRS tidak ditemukan.");
  return NextResponse.json(body, {
    headers: { "Cache-Control": "private, max-age=86400", ETag: `"${dataset}-${viirsMeta.generatedAt}"` },
  });
}
