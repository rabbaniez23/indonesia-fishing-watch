import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorize } from "@/lib/api/guard";
import { can } from "@/lib/auth/roles";
import { getDataStatus } from "@/lib/data-status";

export function GET(request: NextRequest) {
  const auth = authorize(request, "data:read");
  if (!auth.ok) return auth.response;
  const status = getDataStatus({ includeErrorDetail: can(auth.user.role, "dataset:manage") });
  return NextResponse.json({ ok: true, data: status }, { headers: { "Cache-Control": "private, no-store" } });
}
