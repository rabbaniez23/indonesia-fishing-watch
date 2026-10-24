import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorize } from "@/lib/api/guard";
import { listResearchDatasets, saveResearchDataset } from "@/lib/cms/datasets";
import { DATASET_CATEGORIES, type DatasetCategory } from "@/lib/cms/types";
import { validateCsvContent, validateGeoJsonContent } from "@/lib/cms/validator";

const noStore = { "Cache-Control": "private, no-store" };

/** GET /api/cms/datasets — Peneliti (analyst/admin/viewer) dapat melihat daftar dataset riset */
export function GET(request: NextRequest) {
  const auth = authorize(request, "data:read");
  if (!auth.ok) return auth.response;

  const category = request.nextUrl.searchParams.get("category");
  const validCategory = category && (DATASET_CATEGORIES as readonly string[]).includes(category)
    ? (category as DatasetCategory)
    : undefined;

  const list = listResearchDatasets(validCategory);
  return NextResponse.json({ ok: true, data: list }, { headers: noStore });
}

/** POST /api/cms/datasets — Unggah & validasi dataset riset baru oleh Peneliti/Admin */
export async function POST(request: NextRequest) {
  const auth = authorize(request, "dataset:import");
  if (!auth.ok) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const name = formData.get("name")?.toString().trim();
    const category = formData.get("category")?.toString().trim() as DatasetCategory;
    const description = formData.get("description")?.toString().trim() || undefined;

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_INPUT", message: "File wajib dilampirkan." } },
        { status: 400, headers: noStore },
      );
    }

    if (!name || name.length < 3) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_INPUT", message: "Nama dataset minimal 3 karakter." } },
        { status: 400, headers: noStore },
      );
    }

    if (!category || !(DATASET_CATEGORIES as readonly string[]).includes(category)) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_INPUT", message: "Kategori dataset tidak valid." } },
        { status: 400, headers: noStore },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const textContent = buffer.toString("utf-8");

    const fileNameLower = file.name.toLowerCase();
    let validationResult;

    if (fileNameLower.endsWith(".geojson") || fileNameLower.endsWith(".json")) {
      validationResult = validateGeoJsonContent(textContent);
    } else if (fileNameLower.endsWith(".csv") || fileNameLower.endsWith(".txt")) {
      validationResult = validateCsvContent(textContent);
    } else {
      // Coba tebak dari karakter pertama
      const trimmed = textContent.trimStart();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        validationResult = validateGeoJsonContent(textContent);
      } else {
        validationResult = validateCsvContent(textContent);
      }
    }

    if (!validationResult.valid) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "INVALID_INPUT",
            message: validationResult.errorMessage || "Format file tidak valid.",
            details: validationResult.warnings,
          },
        },
        { status: 422, headers: noStore },
      );
    }

    const saved = saveResearchDataset({
      name,
      category,
      description,
      fileName: file.name,
      rawBuffer: buffer,
      validation: validationResult,
      userId: auth.user.id,
    });

    return NextResponse.json({ ok: true, data: saved }, { status: 201, headers: noStore });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "SERVER_ERROR",
          message: error instanceof Error ? error.message : "Terjadi kesalahan saat menyimpan dataset.",
        },
      },
      { status: 500, headers: noStore },
    );
  }
}
