import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorize } from "@/lib/api/guard";
import { validateCsvContent, validateGeoJsonContent } from "@/lib/cms/validator";

const noStore = { "Cache-Control": "private, no-store" };

/** POST /api/cms/validate — Pratinjau validasi instan untuk file sebelum disimpan */
export async function POST(request: NextRequest) {
  const auth = authorize(request, "dataset:import");
  if (!auth.ok) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_INPUT", message: "File wajib disertakan." } },
        { status: 400, headers: noStore },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const textContent = Buffer.from(arrayBuffer).toString("utf-8");
    const fileNameLower = file.name.toLowerCase();

    let result;
    if (fileNameLower.endsWith(".geojson") || fileNameLower.endsWith(".json")) {
      result = validateGeoJsonContent(textContent);
    } else if (fileNameLower.endsWith(".csv") || fileNameLower.endsWith(".txt")) {
      result = validateCsvContent(textContent);
    } else {
      const trimmed = textContent.trimStart();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        result = validateGeoJsonContent(textContent);
      } else {
        result = validateCsvContent(textContent);
      }
    }

    return NextResponse.json({ ok: true, data: result }, { headers: noStore });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_FAILED",
          message: error instanceof Error ? error.message : "Gagal memvalidasi file.",
        },
      },
      { status: 500, headers: noStore },
    );
  }
}
