import { inflateRawSync } from "node:zlib";

/**
 * Pembaca ZIP minimal (stored & deflate) untuk hasil report 4Wings.
 * Membaca central directory; tidak mendukung ZIP64 atau enkripsi (ditolak eksplisit).
 */
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const MAX_ENTRY_BYTES = 200 * 1024 * 1024;

export function readZip(data: Uint8Array): Map<string, Buffer> {
  const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("ZIP tidak valid: end of central directory tidak ditemukan.");

  const count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  if (offset === 0xffffffff) throw new Error("ZIP64 tidak didukung.");

  const files = new Map<string, Buffer>();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(offset) !== CENTRAL_SIGNATURE) throw new Error("ZIP tidak valid: central directory rusak.");
    const flags = buf.readUInt16LE(offset + 8);
    const method = buf.readUInt16LE(offset + 10);
    const compressedSize = buf.readUInt32LE(offset + 20);
    const uncompressedSize = buf.readUInt32LE(offset + 24);
    const nameLength = buf.readUInt16LE(offset + 28);
    const extraLength = buf.readUInt16LE(offset + 30);
    const commentLength = buf.readUInt16LE(offset + 32);
    const localOffset = buf.readUInt32LE(offset + 42);
    const name = buf.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    offset += 46 + nameLength + extraLength + commentLength;

    if (name.endsWith("/")) continue;
    if (flags & 0x1) throw new Error(`ZIP terenkripsi tidak didukung (${name}).`);
    if (uncompressedSize > MAX_ENTRY_BYTES) throw new Error(`Berkas ZIP terlalu besar (${name}).`);
    if (buf.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) throw new Error(`ZIP tidak valid: header lokal ${name}.`);
    const localNameLength = buf.readUInt16LE(localOffset + 26);
    const localExtraLength = buf.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const raw = buf.subarray(start, start + compressedSize);

    if (method === 0) files.set(name, Buffer.from(raw));
    else if (method === 8) files.set(name, inflateRawSync(raw, { maxOutputLength: MAX_ENTRY_BYTES }));
    else throw new Error(`Metode kompresi ZIP ${method} tidak didukung (${name}).`);
  }
  return files;
}
