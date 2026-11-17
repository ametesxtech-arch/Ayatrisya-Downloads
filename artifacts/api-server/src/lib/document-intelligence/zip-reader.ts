import { inflateRawSync } from "node:zlib";

export interface ExtractedZipFile {
  fileName: string;
  data: Buffer;
}

/**
 * Pure TypeScript PKZIP Archive Reader
 * Safely extracts files from DOCX, XLSX, and standard ZIP archives
 * without external dependencies. Enforces strict decompression bounds.
 */
export function extractZipEntries(buffer: Buffer, maxDecompressedTotal = 50 * 1024 * 1024): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  let totalDecompressed = 0;

  // Search for central directory or scan local file headers
  let offset = 0;
  while (offset + 30 <= buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) {
      // Local file header signature not found, break or step
      offset++;
      continue;
    }

    const compressionMethod = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const fileNameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);

    const dataStart = offset + 30 + fileNameLen + extraLen;
    if (dataStart + compressedSize > buffer.length) {
      break;
    }

    const fileName = buffer.toString("utf8", offset + 30, offset + 30 + fileNameLen);
    const compressedData = buffer.subarray(dataStart, dataStart + compressedSize);

    let uncompressedData: Buffer;
    if (compressionMethod === 0) {
      // Stored (no compression)
      uncompressedData = Buffer.from(compressedData);
    } else if (compressionMethod === 8) {
      // Deflate
      try {
        uncompressedData = inflateRawSync(compressedData);
      } catch {
        uncompressedData = Buffer.alloc(0);
      }
    } else {
      uncompressedData = Buffer.alloc(0);
    }

    totalDecompressed += uncompressedData.length;
    if (totalDecompressed > maxDecompressedTotal) {
      throw new Error(`Archive exceeds maximum permitted decompression limit of ${maxDecompressedTotal / (1024 * 1024)} MB.`);
    }

    entries.set(fileName.replace(/\\/g, "/"), uncompressedData);
    offset = dataStart + compressedSize;
  }

  return entries;
}
