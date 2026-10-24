import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getDb, newId, nowIso, transaction } from "@/lib/db";
import type { DatasetCategory, ResearchDataset, ValidationResult } from "./types";

const UPLOAD_DIR = path.join(process.cwd(), "data", "research-uploads");

function ensureUploadDir(): string {
  if (!existsSync(UPLOAD_DIR)) {
    mkdirSync(UPLOAD_DIR, { recursive: true });
  }
  return UPLOAD_DIR;
}

type DatasetRow = {
  id: string;
  name: string;
  category: DatasetCategory;
  description: string | null;
  file_name: string;
  file_type: "csv" | "geojson" | "json";
  file_size: number;
  row_count: number;
  columns_json: string;
  preview_json: string;
  summary_json: string | null;
  status: ResearchDataset["status"];
  error_message: string | null;
  storage_path: string;
  uploaded_by: string;
  uploader_name: string;
  created_at: string;
  updated_at: string;
};

function rowToDataset(row: DatasetRow): ResearchDataset {
  let summary: ResearchDataset["summary"] = {
    hasCoordinates: false,
    hasDate: false,
    description: "",
  };
  try {
    if (row.summary_json) {
      summary = JSON.parse(row.summary_json);
    }
  } catch {
    // fallback default
  }

  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    rowCount: row.row_count,
    columns: JSON.parse(row.columns_json || "[]"),
    previewRows: JSON.parse(row.preview_json || "[]"),
    summary,
    status: row.status,
    errorMessage: row.error_message,
    uploadedBy: {
      id: row.uploaded_by,
      name: row.uploader_name || "Pengguna",
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type SaveDatasetInput = {
  name: string;
  category: DatasetCategory;
  description?: string;
  fileName: string;
  rawBuffer: Buffer;
  validation: ValidationResult;
  userId: string;
};

export function saveResearchDataset(input: SaveDatasetInput): ResearchDataset {
  const dir = ensureUploadDir();
  const id = newId();
  const ext = input.validation.fileType === "geojson" ? "geojson" : input.validation.fileType === "csv" ? "csv" : "json";
  const storageFileName = `${id}.${ext}`;
  const absolutePath = path.join(dir, storageFileName);

  // Simpan file fisik
  writeFileSync(absolutePath, input.rawBuffer);

  const db = getDb();
  const now = nowIso();

  const dataset = transaction(db, () => {
    db.prepare(`
      INSERT INTO research_datasets (
        id, name, category, description, file_name, file_type, file_size,
        row_count, columns_json, preview_json, summary_json, status,
        error_message, storage_path, uploaded_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.name,
      input.category,
      input.description || null,
      input.fileName,
      input.validation.fileType,
      input.rawBuffer.byteLength,
      input.validation.rowCount,
      JSON.stringify(input.validation.columns),
      JSON.stringify(input.validation.previewRows),
      JSON.stringify(input.validation.summary),
      input.validation.valid ? "ready" : "failed",
      input.validation.errorMessage || null,
      storageFileName,
      input.userId,
      now,
      now,
    );

    // Audit log
    db.prepare(`
      INSERT INTO audit_entries (id, actor_id, action, entity_type, entity_id, changes_json, occurred_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      newId(),
      input.userId,
      "dataset:upload",
      "research_dataset",
      id,
      JSON.stringify({
        name: input.name,
        category: input.category,
        fileName: input.fileName,
        rowCount: input.validation.rowCount,
      }),
      now,
    );

    const userRow = db.prepare("SELECT name FROM users WHERE id = ?").get(input.userId) as { name: string } | undefined;

    const row: DatasetRow = {
      id,
      name: input.name,
      category: input.category,
      description: input.description || null,
      file_name: input.fileName,
      file_type: input.validation.fileType,
      file_size: input.rawBuffer.byteLength,
      row_count: input.validation.rowCount,
      columns_json: JSON.stringify(input.validation.columns),
      preview_json: JSON.stringify(input.validation.previewRows),
      summary_json: JSON.stringify(input.validation.summary),
      status: input.validation.valid ? "ready" : "failed",
      error_message: input.validation.errorMessage || null,
      storage_path: storageFileName,
      uploaded_by: input.userId,
      uploader_name: userRow?.name || "Pengguna",
      created_at: now,
      updated_at: now,
    };

    return rowToDataset(row);
  });

  return dataset;
}

export function listResearchDatasets(category?: DatasetCategory): ResearchDataset[] {
  const db = getDb();
  let query = `
    SELECT d.*, u.name as uploader_name
    FROM research_datasets d
    LEFT JOIN users u ON u.id = d.uploaded_by
  `;
  const params: string[] = [];
  if (category) {
    query += " WHERE d.category = ?";
    params.push(category);
  }
  query += " ORDER BY d.created_at DESC";

  const rows = db.prepare(query).all(...params) as DatasetRow[];
  return rows.map(rowToDataset);
}

export function getResearchDatasetById(id: string): ResearchDataset | null {
  const db = getDb();
  const row = db
    .prepare(`
      SELECT d.*, u.name as uploader_name
      FROM research_datasets d
      LEFT JOIN users u ON u.id = d.uploaded_by
      WHERE d.id = ?
    `)
    .get(id) as DatasetRow | undefined;

  return row ? rowToDataset(row) : null;
}

export function deleteResearchDataset(id: string, userId: string): boolean {
  const db = getDb();
  const row = db.prepare("SELECT storage_path FROM research_datasets WHERE id = ?").get(id) as { storage_path: string } | undefined;
  if (!row) return false;

  const absolutePath = path.join(ensureUploadDir(), row.storage_path);

  transaction(db, () => {
    db.prepare("DELETE FROM research_datasets WHERE id = ?").run(id);
    db.prepare(`
      INSERT INTO audit_entries (id, actor_id, action, entity_type, entity_id, changes_json, occurred_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(newId(), userId, "dataset:delete", "research_dataset", id, null, nowIso());
  });

  if (existsSync(absolutePath)) {
    try {
      unlinkSync(absolutePath);
    } catch {
      // Abaikan jika file sudah tidak ada
    }
  }

  return true;
}

export function getResearchDatasetContent(id: string): { fileName: string; fileType: string; content: string } | null {
  const db = getDb();
  const row = db.prepare("SELECT file_name, file_type, storage_path FROM research_datasets WHERE id = ?").get(id) as
    | { file_name: string; file_type: string; storage_path: string }
    | undefined;

  if (!row) return null;
  const absolutePath = path.join(ensureUploadDir(), row.storage_path);
  if (!existsSync(absolutePath)) return null;

  const content = readFileSync(absolutePath, "utf-8");
  return {
    fileName: row.file_name,
    fileType: row.file_type,
    content,
  };
}
