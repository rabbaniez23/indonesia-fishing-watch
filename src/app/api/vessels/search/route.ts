import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { gfwErrorResponse } from "@/lib/api/gfw-errors";
import { apiError, authorize } from "@/lib/api/guard";
import { searchVessels } from "@/lib/gfw/adapters";
import { summarizeIdentity } from "@/lib/vessels/identity";

/** GET /api/vessels/search?q=&since= — kandidat identitas (tidak digabung), pagination token GFW. */
export async function GET(request: NextRequest) {
  const auth = authorize(request, "data:read");
  if (!auth.ok) return auth.response;
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const since = request.nextUrl.searchParams.get("since");
  if (q.length < 3 || q.length > 100) return apiError(400, "INVALID_INPUT", "Kata kunci pencarian 3–100 karakter.");
  if (since && since.length > 2000) return apiError(400, "INVALID_INPUT", "Token halaman tidak valid.");
  try {
    const result = await searchVessels({ query: q, since, limit: 20 });
    return NextResponse.json(
      {
        ok: true,
        data: {
          total: result.total,
          since: result.since,
          candidates: result.candidates.map((c) => ({ summary: summarizeIdentity(c), identity: c })),
          rejected: result.rejected,
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
