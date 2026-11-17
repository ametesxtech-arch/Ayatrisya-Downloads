import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pipeline } from "node:stream/promises";

export const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB max limit
export const MAX_CHUNK_SIZE = 15 * 1024 * 1024; // 15 MB max per chunk
export const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour TTL

export interface UploadSession {
  uploadId: string;
  userId?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  uploadedChunks: Set<number>;
  clientHash?: string;
  finalHash?: string;
  assembledFilePath?: string;
  status: "initializing" | "uploading" | "assembled" | "completed" | "expired" | "failed";
  createdAt: number;
  updatedAt: number;
  tempDir: string;
}

export class UploadEngine {
  private sessions = new Map<string, UploadSession>();
  private baseTempDir: string;

  constructor(customTempDir?: string) {
    this.baseTempDir = customTempDir || path.join(os.tmpdir(), "ayatrisya_uploads");
    try {
      if (!fs.existsSync(this.baseTempDir)) {
        fs.mkdirSync(this.baseTempDir, { recursive: true });
      }
    } catch {}

    // Cleanup every 15 minutes
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 15 * 60 * 1000).unref();
  }

  initSession(params: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    totalChunks: number;
    userId?: string;
    clientHash?: string;
  }): { uploadId: string; session: UploadSession } {
    if (params.fileSize > MAX_FILE_SIZE) {
      throw new Error(`File size ${params.fileSize} bytes exceeds maximum permitted 500 MB limit.`);
    }

    if (params.totalChunks < 1) {
      throw new Error("Total chunks must be at least 1.");
    }

    const uploadId = `upl_${randomUUID().replace(/-/g, "")}`;
    const sessionTempDir = path.join(this.baseTempDir, uploadId);
    fs.mkdirSync(sessionTempDir, { recursive: true });

    const session: UploadSession = {
      uploadId,
      userId: params.userId,
      fileName: path.basename(params.fileName),
      fileSize: params.fileSize,
      mimeType: params.mimeType || "application/octet-stream",
      totalChunks: params.totalChunks,
      uploadedChunks: new Set<number>(),
      clientHash: params.clientHash,
      status: "uploading",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tempDir: sessionTempDir,
    };

    this.sessions.set(uploadId, session);
    return { uploadId, session };
  }

  async saveChunk(params: {
    uploadId: string;
    chunkIndex: number;
    chunkBuffer: Buffer;
    chunkChecksum?: string;
  }): Promise<{ chunkIndex: number; verified: boolean; bytesUploaded: number; progressPercent: number }> {
    const session = this.sessions.get(params.uploadId);
    if (!session) {
      throw new Error(`Upload session '${params.uploadId}' was not found or has expired.`);
    }

    if (params.chunkIndex < 0 || params.chunkIndex >= session.totalChunks) {
      throw new Error(`Chunk index ${params.chunkIndex} out of bounds (total: ${session.totalChunks}).`);
    }

    if (params.chunkBuffer.length > MAX_CHUNK_SIZE) {
      throw new Error(`Chunk size ${params.chunkBuffer.length} bytes exceeds maximum 15 MB per chunk.`);
    }

    // Verify chunk SHA-256 if supplied
    if (params.chunkChecksum) {
      const computed = createHash("sha256").update(params.chunkBuffer).digest("hex");
      if (computed.toLowerCase() !== params.chunkChecksum.toLowerCase()) {
        throw new Error(`Chunk checksum mismatch for chunk ${params.chunkIndex}.`);
      }
    }

    // Stream chunk directly to disk
    const chunkPath = path.join(session.tempDir, `chunk_${params.chunkIndex}.part`);
    await fs.promises.writeFile(chunkPath, params.chunkBuffer);

    session.uploadedChunks.add(params.chunkIndex);
    session.updatedAt = Date.now();

    const progressPercent = Math.round((session.uploadedChunks.size / session.totalChunks) * 100);
    const bytesUploaded = session.uploadedChunks.size * params.chunkBuffer.length;

    return {
      chunkIndex: params.chunkIndex,
      verified: true,
      bytesUploaded: Math.min(bytesUploaded, session.fileSize),
      progressPercent,
    };
  }

  async assembleFile(uploadId: string): Promise<{ assembledPath: string; sha256: string; totalBytes: number }> {
    const session = this.sessions.get(uploadId);
    if (!session) {
      throw new Error(`Upload session '${uploadId}' was not found.`);
    }

    if (session.uploadedChunks.size < session.totalChunks) {
      throw new Error(
        `Cannot assemble file: only ${session.uploadedChunks.size} of ${session.totalChunks} chunks uploaded.`
      );
    }

    const assembledPath = path.join(session.tempDir, `complete_${session.fileName}`);
    const writeStream = fs.createWriteStream(assembledPath);
    const hash = createHash("sha256");

    let totalWritten = 0;

    for (let i = 0; i < session.totalChunks; i++) {
      const chunkPath = path.join(session.tempDir, `chunk_${i}.part`);
      if (!fs.existsSync(chunkPath)) {
        throw new Error(`Missing expected chunk file ${i}.`);
      }

      const chunkData = await fs.promises.readFile(chunkPath);
      hash.update(chunkData);
      writeStream.write(chunkData);
      totalWritten += chunkData.length;

      // Clean up part immediately to free disk space
      try {
        await fs.promises.unlink(chunkPath);
      } catch {}
    }

    await new Promise<void>((resolve, reject) => {
      writeStream.end((err?: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const finalSha256 = hash.digest("hex");

    if (session.clientHash && session.clientHash.toLowerCase() !== finalSha256.toLowerCase()) {
      session.status = "failed";
      throw new Error("File integrity check failed: assembled SHA-256 does not match client hash.");
    }

    session.status = "completed";
    session.finalHash = finalSha256;
    session.assembledFilePath = assembledPath;

    return {
      assembledPath,
      sha256: finalSha256,
      totalBytes: totalWritten,
    };
  }

  getSession(uploadId: string): UploadSession | undefined {
    return this.sessions.get(uploadId);
  }

  cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.updatedAt > SESSION_TTL_MS) {
        try {
          if (fs.existsSync(session.tempDir)) {
            fs.rmSync(session.tempDir, { recursive: true, force: true });
          }
        } catch {}
        this.sessions.delete(id);
      }
    }
  }

  deleteSession(uploadId: string): boolean {
    const session = this.sessions.get(uploadId);
    if (!session) return false;
    try {
      if (fs.existsSync(session.tempDir)) {
        fs.rmSync(session.tempDir, { recursive: true, force: true });
      }
    } catch {}
    this.sessions.delete(uploadId);
    return true;
  }
}

export const globalUploadEngine = new UploadEngine();
