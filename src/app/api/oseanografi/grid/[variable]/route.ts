import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, authorize } from "@/lib/api/guard";
import { oceanMeta } from "@/lib/oseanografi/data";

/** Grid peta oseanografi per variabel (statis, dibangun offline). Dibaca dari disk & disimpan di memori. */
const cache = new Map<string, string>();

export async function GET(request: NextRequest, ctx: RouteContext<"/api/oseanografi/grid/[variable]">) {
  const auth = authorize(request, "data:read");
  if (!auth.ok) return auth.response;
  const { variable } = await ctx.params;
  // Allowlist dari meta — nama berkas tidak pernah diambil mentah dari URL.
  const known = oceanMeta.variables.find((v) => v.key === variable);
  if (!known) return apiError(404, "NOT_FOUND", "Variabel oseanografi tidak ditemukan.");
  let body = cache.get(known.key);
  if (!body) {
    try {
      body = await readFile(path.join(process.cwd(), "src", "data", "oseanografi", "grids", `${known.key}.json`), "utf-8");
    } catch {
      return apiError(404, "NOT_FOUND", "Grid oseanografi belum dibangun.");
    }
    cache.set(known.key, body);
  }
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=86400",
      ETag: `"${known.key}-${oceanMeta.generatedAt}"`,
    },
  });
}
