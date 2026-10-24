import type { ValidationResult } from "./types";

/**
 * Parser CSV sederhana & tangguh tanpa dependensi eksternal,
 * mendukung koma di dalam tanda kutip ("...") dan variasi newline (CRLF/LF).
 */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: "" -> "
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === "," || char === ";") {
        currentRow.push(currentField.trim());
        currentField = "";
      } else if (char === "\r") {
        if (nextChar === "\n") i++;
        currentRow.push(currentField.trim());
        if (currentRow.some((f) => f.length > 0)) rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else if (char === "\n") {
        currentRow.push(currentField.trim());
        if (currentRow.some((f) => f.length > 0)) rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) rows.push(currentRow);
  }

  return rows;
}

const LAT_KEYWORDS = ["lat", "latitude", "lintang", "y", "lat_deg", "pos_lat"];
const LON_KEYWORDS = ["lon", "lng", "longitude", "long", "bujur", "x", "lon_deg", "pos_lon"];
const DATE_KEYWORDS = ["date", "tanggal", "time", "waktu", "timestamp", "datetime", "tgl", "recorded_at"];

export function validateCsvContent(rawText: string): ValidationResult {
  const rows = parseCsvRows(rawText);
  if (rows.length === 0) {
    return {
      valid: false,
      fileType: "csv",
      rowCount: 0,
      columns: [],
      previewRows: [],
      summary: { hasCoordinates: false, hasDate: false, description: "File CSV kosong." },
      warnings: [],
      errorMessage: "File CSV tidak memiliki data atau baris judul.",
    };
  }

  const rawHeaders = rows[0];
  const headers = rawHeaders.map((h, i) => h.trim() || `kolom_${i + 1}`);
  const dataRows = rows.slice(1);

  if (dataRows.length === 0) {
    return {
      valid: false,
      fileType: "csv",
      rowCount: 0,
      columns: headers,
      previewRows: [],
      summary: { hasCoordinates: false, hasDate: false, description: "Hanya baris judul, tidak ada baris data." },
      warnings: ["Tidak ditemukan baris data setelah baris judul."],
      errorMessage: "File CSV hanya berisi baris header tanpa data.",
    };
  }

  // Cari kolom koordinat
  let latIdx = -1;
  let lonIdx = -1;
  let dateIdx = -1;

  headers.forEach((h, idx) => {
    const clean = h.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (latIdx === -1 && LAT_KEYWORDS.some((kw) => clean === kw || clean.endsWith(`_${kw}`) || clean.startsWith(`${kw}_`))) {
      latIdx = idx;
    }
    if (lonIdx === -1 && LON_KEYWORDS.some((kw) => clean === kw || clean.endsWith(`_${kw}`) || clean.startsWith(`${kw}_`))) {
      lonIdx = idx;
    }
    if (dateIdx === -1 && DATE_KEYWORDS.some((kw) => clean === kw || clean.endsWith(`_${kw}`) || clean.startsWith(`${kw}_`))) {
      dateIdx = idx;
    }
  });

  let validCoordsCount = 0;
  let minLat = 90;
  let maxLat = -90;
  let minLon = 180;
  let maxLon = -180;
  const warnings: string[] = [];

  const previewCount = Math.min(10, dataRows.length);
  const previewRows: Array<Record<string, unknown>> = [];

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    const rowObj: Record<string, unknown> = {};
    for (let c = 0; c < headers.length; c++) {
      rowObj[headers[c]] = row[c] ?? "";
    }
    if (r < previewCount) {
      previewRows.push(rowObj);
    }

    if (latIdx !== -1 && lonIdx !== -1) {
      const latVal = parseFloat(row[latIdx]);
      const lonVal = parseFloat(row[lonIdx]);
      if (!Number.isNaN(latVal) && !Number.isNaN(lonVal) && latVal >= -90 && latVal <= 90 && lonVal >= -180 && lonVal <= 180) {
        validCoordsCount++;
        if (latVal < minLat) minLat = latVal;
        if (latVal > maxLat) maxLat = latVal;
        if (lonVal < minLon) minLon = lonVal;
        if (lonVal > maxLon) maxLon = lonVal;
      }
    }
  }

  const hasCoords = latIdx !== -1 && lonIdx !== -1 && validCoordsCount > 0;
  const bbox: [number, number, number, number] | undefined = hasCoords ? [minLon, minLat, maxLon, maxLat] : undefined;

  let description = `${dataRows.length.toLocaleString("id-ID")} baris data terdeteksi dengan ${headers.length} kolom.`;
  if (hasCoords) {
    description += ` Koordinat geografis valid ditemukan pada ${validCoordsCount.toLocaleString("id-ID")} baris (${headers[latIdx]} & ${headers[lonIdx]}).`;
    if (validCoordsCount < dataRows.length) {
      warnings.push(`${dataRows.length - validCoordsCount} baris memiliki nilai koordinat kosong atau tidak valid.`);
    }
  } else {
    warnings.push("Kolom koordinat lintang/bujur (latitude/longitude) tidak terdeteksi otomatis.");
  }

  return {
    valid: true,
    fileType: "csv",
    rowCount: dataRows.length,
    columns: headers,
    previewRows,
    summary: {
      hasCoordinates: hasCoords,
      coordColumns: hasCoords ? { lat: headers[latIdx], lon: headers[lonIdx] } : undefined,
      validCoordinatesCount: validCoordsCount,
      hasDate: dateIdx !== -1,
      dateColumn: dateIdx !== -1 ? headers[dateIdx] : undefined,
      bbox,
      description,
    },
    warnings,
  };
}

export function validateGeoJsonContent(rawText: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    return {
      valid: false,
      fileType: "geojson",
      rowCount: 0,
      columns: [],
      previewRows: [],
      summary: { hasCoordinates: false, hasDate: false, description: "Format JSON tidak valid." },
      warnings: [],
      errorMessage: `Gagal membaca format JSON: ${err instanceof Error ? err.message : "Sintaks JSON tidak sesuai"}`,
    };
  }

  if (!parsed || typeof parsed !== "object") {
    return {
      valid: false,
      fileType: "geojson",
      rowCount: 0,
      columns: [],
      previewRows: [],
      summary: { hasCoordinates: false, hasDate: false, description: "Objek JSON tidak valid." },
      warnings: [],
      errorMessage: "Isi file bukan objek GeoJSON yang valid.",
    };
  }

  const geo = parsed as {
    type?: string;
    features?: Array<{ type?: string; geometry?: { type: string; coordinates: unknown }; properties?: Record<string, unknown> }>;
    geometry?: { type: string; coordinates: unknown };
    properties?: Record<string, unknown>;
  };

  const featureTypes = new Set<string>();
  const propertyKeys = new Set<string>();
  const previewRows: Array<Record<string, unknown>> = [];
  let featuresCount = 0;
  let minLat = 90;
  let maxLat = -90;
  let minLon = 180;
  let maxLon = -180;

  function processCoordinates(coords: unknown) {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      const [lon, lat] = coords as [number, number];
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
      }
    } else {
      coords.forEach(processCoordinates);
    }
  }

  if (geo.type === "FeatureCollection" && Array.isArray(geo.features)) {
    featuresCount = geo.features.length;
    geo.features.slice(0, 10).forEach((feat) => {
      if (feat.properties) {
        previewRows.push(feat.properties);
        Object.keys(feat.properties).forEach((k) => propertyKeys.add(k));
      }
      if (feat.geometry?.type) featureTypes.add(feat.geometry.type);
    });

    geo.features.forEach((feat) => {
      if (feat.geometry?.coordinates) processCoordinates(feat.geometry.coordinates);
      if (feat.properties) Object.keys(feat.properties).forEach((k) => propertyKeys.add(k));
      if (feat.geometry?.type) featureTypes.add(feat.geometry.type);
    });
  } else if (geo.type === "Feature") {
    featuresCount = 1;
    if (geo.properties) {
      previewRows.push(geo.properties);
      Object.keys(geo.properties).forEach((k) => propertyKeys.add(k));
    }
    if (geo.geometry?.type) featureTypes.add(geo.geometry.type);
    if (geo.geometry?.coordinates) processCoordinates(geo.geometry.coordinates);
  } else {
    return {
      valid: false,
      fileType: "geojson",
      rowCount: 0,
      columns: [],
      previewRows: [],
      summary: { hasCoordinates: false, hasDate: false, description: "GeoJSON harus bertipe FeatureCollection atau Feature." },
      warnings: [],
      errorMessage: `Tipe GeoJSON '${geo.type || "unknown"}' tidak didukung. Harap gunakan FeatureCollection standar.`,
    };
  }

  const columns = Array.from(propertyKeys);
  const typeList = Array.from(featureTypes);
  const hasCoords = minLat <= maxLat && minLon <= maxLon;
  const bbox: [number, number, number, number] | undefined = hasCoords ? [minLon, minLat, maxLon, maxLat] : undefined;

  const description = `${featuresCount.toLocaleString("id-ID")} fitur spasial (${typeList.join(", ")}) terdeteksi dengan ${columns.length} atribut.`;

  return {
    valid: true,
    fileType: "geojson",
    rowCount: featuresCount,
    columns,
    previewRows,
    summary: {
      hasCoordinates: hasCoords,
      validCoordinatesCount: featuresCount,
      hasDate: false,
      bbox,
      featureTypes: typeList,
      description,
    },
    warnings: [],
  };
}
