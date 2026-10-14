/**
 * Penulis CSV untuk ekspor (FR-10).
 * - Format angka mesin: titik desimal, tanpa pemisah ribuan (didokumentasikan di metadata).
 * - Teks yang diawali = + - @ TAB CR diberi awalan apostrof agar tidak dieksekusi sebagai formula
 *   oleh aplikasi spreadsheet (pencegahan formula/CSV injection); angka tidak diubah.
 * - Field berisi koma, kutip, atau baris baru dikutip dengan kutip ganda (RFC 4180).
 * - UTF-8 dengan BOM agar karakter Indonesia terbaca di Excel.
 */

export type CsvValue = string | number | boolean | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

export function escapeCsvField(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  let text = value;
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: CsvValue[][]): string {
  const lines = [header.map(escapeCsvField).join(","), ...rows.map((r) => r.map(escapeCsvField).join(","))];
  return "﻿" + lines.join("\r\n") + "\r\n";
}
