import { downloadBlob } from '@/storage/backup';

// CRC-32 Lookup Table
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c;
}

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipFileEntry {
  path: string;
  data: Uint8Array | string;
}

/**
 * Creates a standard uncompressed ZIP file (STORE mode) in memory.
 * Supported across all modern platforms, browsers, and operating systems.
 */
export function buildZipArchive(entries: ZipFileEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const fileHeaders: Uint8Array[] = [];
  const fileRecords: Uint8Array[] = [];

  let currentOffset = 0;

  for (const entry of entries) {
    const rawData = typeof entry.data === 'string' ? encoder.encode(entry.data) : entry.data;
    const filenameBytes = encoder.encode(entry.path);
    const uncompressedSize = rawData.length;
    const fileCrc = crc32(rawData);

    // Local file header (30 bytes + name)
    const localHeader = new Uint8Array(30 + filenameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // Local file header signature
    lv.setUint16(4, 20, true); // Version needed to extract (2.0)
    lv.setUint16(6, 0, true); // General purpose bit flag
    lv.setUint16(8, 0, true); // Compression method (0 = store)
    lv.setUint16(10, 0, true); // Last mod file time
    lv.setUint16(12, 0x5421, true); // Last mod file date
    lv.setUint32(14, fileCrc, true); // CRC-32
    lv.setUint32(18, uncompressedSize, true); // Compressed size
    lv.setUint32(22, uncompressedSize, true); // Uncompressed size
    lv.setUint16(26, filenameBytes.length, true); // File name length
    lv.setUint16(28, 0, true); // Extra field length
    localHeader.set(filenameBytes, 30);

    // Central directory header (46 bytes + name)
    const centralHeader = new Uint8Array(46 + filenameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true); // Central directory file header signature
    cv.setUint16(4, 20, true); // Version made by
    cv.setUint16(6, 20, true); // Version needed to extract (2.0)
    cv.setUint16(8, 0, true); // General purpose bit flag
    cv.setUint16(10, 0, true); // Compression method (0 = store)
    cv.setUint16(12, 0, true); // Last mod file time
    cv.setUint16(14, 0x5421, true); // Last mod file date
    cv.setUint32(16, fileCrc, true); // CRC-32
    cv.setUint32(20, uncompressedSize, true); // Compressed size
    cv.setUint32(24, uncompressedSize, true); // Uncompressed size
    cv.setUint16(28, filenameBytes.length, true); // File name length
    cv.setUint16(30, 0, true); // Extra field length
    cv.setUint16(32, 0, true); // File comment length
    cv.setUint16(34, 0, true); // Disk number start
    cv.setUint16(36, 0, true); // Internal file attributes
    cv.setUint32(38, 0, true); // External file attributes
    cv.setUint32(42, currentOffset, true); // Relative offset of local header
    centralHeader.set(filenameBytes, 46);

    fileRecords.push(localHeader, rawData);
    fileHeaders.push(centralHeader);

    currentOffset += localHeader.length + rawData.length;
  }

  // End of central directory record (22 bytes)
  const centralDirSize = fileHeaders.reduce((acc, h) => acc + h.length, 0);
  const endRecord = new Uint8Array(22);
  const ev = new DataView(endRecord.buffer);
  ev.setUint32(0, 0x06054b50, true); // End of central dir signature
  ev.setUint16(4, 0, true); // Number of this disk
  ev.setUint16(6, 0, true); // Disk where central directory starts
  ev.setUint16(8, entries.length, true); // Number of central directory records on this disk
  ev.setUint16(10, entries.length, true); // Total number of central directory records
  ev.setUint32(12, centralDirSize, true); // Size of central directory
  ev.setUint32(16, currentOffset, true); // Offset of start of central directory
  ev.setUint16(20, 0, true); // Comment length

  const totalLength = currentOffset + centralDirSize + 22;
  const result = new Uint8Array(totalLength);
  let pos = 0;

  for (const part of fileRecords) {
    result.set(part, pos);
    pos += part.length;
  }
  for (const part of fileHeaders) {
    result.set(part, pos);
    pos += part.length;
  }
  result.set(endRecord, pos);

  return result;
}

export function downloadZip(filename: string, entries: ZipFileEntry[]): void {
  const bytes = buildZipArchive(entries);
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/zip' });
  downloadBlob(blob, filename.endsWith('.zip') ? filename : `${filename}.zip`);
}
