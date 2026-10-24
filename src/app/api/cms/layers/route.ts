import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorize } from "@/lib/api/guard";
import { createCustomLayer, listCustomLayers } from "@/lib/cms/layers";

const noStore = { "Cache-Control": "private, no-store" };

/** GET /api/cms/layers — Pengguna dapat melihat daftar layer kustom (aktif atau semua) */
export function GET(request: NextRequest) {
  const auth = authorize(request, "data:read");
  if (!auth.ok) return auth.response;

  const onlyVisible = request.nextUrl.searchParams.get("active") === "1";
  const layers = listCustomLayers(onlyVisible);
  return NextResponse.json({ ok: true, data: layers }, { headers: noStore });
}

/** POST /api/cms/layers — Peneliti/Admin membuat lapisan peta baru dari dataset */
export async function POST(request: NextRequest) {
  const auth = authorize(request, "dataset:import");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_INPUT", message: "Data permintaan tidak valid." } },
        { status: 400, headers: noStore },
      );
    }

    const { datasetId, name, description, layerType, color, strokeColor, opacity, isVisible } = body;

    if (!datasetId || typeof datasetId !== "string") {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_INPUT", message: "Dataset sumber wajib dipilih." } },
        { status: 400, headers: noStore },
      );
    }

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_INPUT", message: "Nama layer minimal 2 karakter." } },
        { status: 400, headers: noStore },
      );
    }

    if (!["point", "line", "polygon"].includes(layerType)) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_INPUT", message: "Tipe geometri harus point, line, atau polygon." } },
        { status: 400, headers: noStore },
      );
    }

    const created = createCustomLayer({
      datasetId,
      name: name.trim(),
      description: typeof description === "string" ? description.trim() : undefined,
      layerType,
      color: typeof color === "string" ? color : undefined,
      strokeColor: typeof strokeColor === "string" ? strokeColor : undefined,
      opacity: typeof opacity === "number" ? opacity : undefined,
      isVisible: typeof isVisible === "boolean" ? isVisible : undefined,
      userId: auth.user.id,
    });

    return NextResponse.json({ ok: true, data: created }, { status: 201, headers: noStore });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "SERVER_ERROR",
          message: error instanceof Error ? error.message : "Gagal membuat lapisan peta.",
        },
      },
      { status: 500, headers: noStore },
    );
  }
}
