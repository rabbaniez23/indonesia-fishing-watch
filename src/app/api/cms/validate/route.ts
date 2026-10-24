import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorize } from "@/lib/api/guard";
import { validateCsvContent, validateGeoJsonContent } from "@/lib/cms/validator";
import { MAX_UPLOAD_BYTES } from "@/lib/cms/types";

const noStore = { "Cache-Control": "private, no-store" };

/** Tolak sebelum body dibaca bila Content-Length melebihi batas (+64 KB untuk kolom form lain). */
function uploadTooLarge(request: NextRequest): boolean {
  const length = Number(request.headers.get("content-length") ?? "0");
  return Number.isFinite(length) && length > MAX_UPLOAD_BYTES + 64 * 1024;
}

const tooLargeBody = {
  ok: false,
  error: { code: "PAYLOAD_TOO_LARGE", message: `Ukuran file maksimal ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` },
};

/** POST /api/cms/validate — Pratinjau validasi instan untuk file sebelum disimpan */
export async function POST(request: NextRequest) {
  const auth = authorize(request, "cms:manage");
  if (!auth.ok) return auth.response;
  if (uploadTooLarge(request)) return NextResponse.json(tooLargeBody, { status: 413, headers: noStore });

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_INPUT", message: "File wajib disertakan." } },
        { status: 400, headers: noStore },
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json(tooLargeBody, { status: 413, headers: noStore });

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
