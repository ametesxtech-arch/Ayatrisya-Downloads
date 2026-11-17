import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB max limit
export const MAX_CHUNK_SIZE = 15 * 1024 * 1024; // 15 MB max per chunk
export const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour TTL
export const MAX_GLOBAL_STAGING_BYTES = 1500 * 1024 * 1024; // 1.5 GB global buffer cap
export const MAX_USER_CONCURRENT_UPLOADS = 2; // 2 concurrent uploads per user

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

    // 1. Check Global Staging Quota
    let currentStagedBytes = 0;
    let userActiveUploads = 0;
    for (const s of this.sessions.values()) {
      if (s.status === "uploading" || s.status === "assembled") {
        currentStagedBytes += s.fileSize;
        if (params.userId && s.userId === params.userId) {
          userActiveUploads++;
        }
      }
    }

    if (currentStagedBytes + params.fileSize > MAX_GLOBAL_STAGING_BYTES) {
      throw new Error("Global upload staging capacity reached (1.5 GB limit). Please wait for active uploads to finalize.");
    }

    // 2. Check User Concurrency Quota
    if (params.userId && userActiveUploads >= MAX_USER_CONCURRENT_UPLOADS) {
      throw new Error(`User upload concurrency quota exceeded (maximum ${MAX_USER_CONCURRENT_UPLOADS} active uploads per user).`);
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

  verifySessionOwner(uploadId: string, userId?: string): UploadSession {
    const session = this.sessions.get(uploadId);
    if (!session) {
      throw new Error(`Upload session '${uploadId}' was not found or has expired.`);
    }

    if (session.userId && userId && session.userId !== userId) {
      throw new Error("Unauthorized: you do not have permission to access or modify this upload session.");
    }

    return session;
  }

  async saveChunk(params: {
    uploadId: string;
    userId?: string;
    chunkIndex: number;
    chunkBuffer: Buffer;
    chunkChecksum?: string;
  }): Promise<{ chunkIndex: number; verified: boolean; bytesUploaded: number; progressPercent: number }> {
    const session = this.verifySessionOwner(params.uploadId, params.userId);

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

  async assembleFile(uploadId: string, userId?: string): Promise<{ assembledPath: string; sha256: string; totalBytes: number }> {
    const session = this.verifySessionOwner(uploadId, userId);

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

    // Clean orphaned directories on disk (e.g. from prior process crashes)
    try {
      if (fs.existsSync(this.baseTempDir)) {
        const dirs = fs.readdirSync(this.baseTempDir);
        for (const dirName of dirs) {
          if (!this.sessions.has(dirName)) {
            const fullPath = path.join(this.baseTempDir, dirName);
            const stats = fs.statSync(fullPath);
            if (now - stats.mtimeMs > SESSION_TTL_MS) {
              fs.rmSync(fullPath, { recursive: true, force: true });
            }
          }
        }
      }
    } catch {}
  }

  deleteSession(uploadId: string, userId?: string): boolean {
    const session = this.verifySessionOwner(uploadId, userId);
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
