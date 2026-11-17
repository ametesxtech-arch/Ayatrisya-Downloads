import { deflateRawSync } from "node:zlib";

/**
 * Pure TypeScript / Node.js standard PKZIP Archive Generator
 * Requires zero external dependencies, uses native deflate compression.
 */

// Precomputed CRC32 lookup table
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c;
}

export function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  path: string;
  data: Buffer | string;
}

export class SimpleZip {
  private entries: Array<{
    path: string;
    uncompressedData: Buffer;
    compressedData: Buffer;
    crc: number;
    offset: number;
  }> = [];

  addFile(path: string, content: Buffer | string): void {
    const uncompressedData = typeof content === "string" ? Buffer.from(content, "utf-8") : content;
    const crc = crc32(uncompressedData);
    const compressedData = deflateRawSync(uncompressedData, { level: 6 });
    this.entries.push({
      path: path.replace(/\\/g, "/"),
      uncompressedData,
      compressedData,
      crc,
      offset: 0,
    });
  }

  generate(): Buffer {
    const parts: Buffer[] = [];
    let currentOffset = 0;

    // 1. Write Local File Headers + Compressed Data
    for (const entry of this.entries) {
      entry.offset = currentOffset;
      const pathBuf = Buffer.from(entry.path, "utf-8");

      // Local file header (30 bytes)
      const header = Buffer.alloc(30);
      header.writeUInt32LE(0x04034b50, 0); // Local file header signature
      header.writeUInt16LE(20, 4); // Version needed to extract (2.0)
      header.writeUInt16LE(0x0800, 6); // General purpose bit flag (UTF-8)
      header.writeUInt16LE(8, 8); // Compression method: 8 = Deflate
      header.writeUInt16LE(0, 10); // Last mod file time
      header.writeUInt16LE(0, 12); // Last mod file date
      header.writeUInt32LE(entry.crc, 14); // CRC-32
      header.writeUInt32LE(entry.compressedData.length, 18); // Compressed size
      header.writeUInt32LE(entry.uncompressedData.length, 22); // Uncompressed size
      header.writeUInt16LE(pathBuf.length, 26); // File name length
      header.writeUInt16LE(0, 28); // Extra field length

      parts.push(header, pathBuf, entry.compressedData);
      currentOffset += 30 + pathBuf.length + entry.compressedData.length;
    }

    const centralDirStartOffset = currentOffset;
    let centralDirSize = 0;

    // 2. Write Central Directory Headers
    for (const entry of this.entries) {
      const pathBuf = Buffer.from(entry.path, "utf-8");
      const cdHeader = Buffer.alloc(46);

      cdHeader.writeUInt32LE(0x02014b50, 0); // Central file header signature
      cdHeader.writeUInt16LE(20, 4); // Version made by
      cdHeader.writeUInt16LE(20, 6); // Version needed to extract
      cdHeader.writeUInt16LE(0x0800, 8); // General purpose bit flag (UTF-8)
      cdHeader.writeUInt16LE(8, 10); // Compression method
      cdHeader.writeUInt16LE(0, 12); // Last mod file time
      cdHeader.writeUInt16LE(0, 14); // Last mod file date
      cdHeader.writeUInt32LE(entry.crc, 16); // CRC-32
      cdHeader.writeUInt32LE(entry.compressedData.length, 20); // Compressed size
      cdHeader.writeUInt32LE(entry.uncompressedData.length, 24); // Uncompressed size
      cdHeader.writeUInt16LE(pathBuf.length, 28); // File name length
      cdHeader.writeUInt16LE(0, 30); // Extra field length
      cdHeader.writeUInt16LE(0, 32); // File comment length
      cdHeader.writeUInt16LE(0, 34); // Disk number start
      cdHeader.writeUInt16LE(0, 36); // Internal file attributes
      cdHeader.writeUInt32LE(0, 38); // External file attributes
      cdHeader.writeUInt32LE(entry.offset, 42); // Relative offset of local header

      parts.push(cdHeader, pathBuf);
      const entryCdSize = 46 + pathBuf.length;
      centralDirSize += entryCdSize;
      currentOffset += entryCdSize;
    }

    // 3. Write End of Central Directory Record (22 bytes)
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); // End of central dir signature
    eocd.writeUInt16LE(0, 4); // Number of this disk
    eocd.writeUInt16LE(0, 6); // Disk where central directory starts
    eocd.writeUInt16LE(this.entries.length, 8); // Number of central directory records on this disk
    eocd.writeUInt16LE(this.entries.length, 10); // Total number of central directory records
    eocd.writeUInt32LE(centralDirSize, 12); // Size of central directory
    eocd.writeUInt32LE(centralDirStartOffset, 16); // Offset of start of central directory
    eocd.writeUInt16LE(0, 20); // Comment length

    parts.push(eocd);

    return Buffer.concat(parts);
  }
}
