import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorize } from "@/lib/api/guard";

export function GET(request: NextRequest) {
  const auth = authorize(request, "data:read");
  if (!auth.ok) return auth.response;
  return NextResponse.json({ ok: true, data: auth.user }, { headers: { "Cache-Control": "private, no-store" } });
}
