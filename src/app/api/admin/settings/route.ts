import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, authorize } from "@/lib/api/guard";
import { budgetToday } from "@/lib/gfw/http";
import { BUDGET_MAX, BUDGET_MIN, setDailyBudget } from "@/lib/settings";

const bodySchema = z.object({ gfwDailyBudget: z.number().int().min(BUDGET_MIN).max(BUDGET_MAX) });

/** Admin mengatur budget request GFW harian aplikasi (≤ batas provider 50.000/hari). */
export async function PUT(request: NextRequest) {
  const auth = authorize(request, "dataset:manage");
  if (!auth.ok) return auth.response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_INPUT", `Budget harus bilangan bulat ${BUDGET_MIN}–${BUDGET_MAX}.`);
  setDailyBudget(parsed.data.gfwDailyBudget, auth.user.id);
  return NextResponse.json({ ok: true, data: budgetToday() }, { headers: { "Cache-Control": "private, no-store" } });
}
