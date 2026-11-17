import express, { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { verifiedFirebaseUid } from "../lib/firebase-auth";
import { globalUploadEngine } from "../lib/upload-engine/session-store";
import { analyzeDocument, queryDocumentGrounding } from "../lib/document-intelligence/extractor";

const router: IRouter = Router();

const authMessages = {
  missing: "Sign in to Ayatrisya to upload and process files.",
  unavailable: "Authentication service is temporarily unavailable.",
  invalid: "Your sign-in session expired. Sign in again and retry.",
};

const InitUploadSchema = z.object({
  fileName: z.string().min(1, "fileName is required"),
  fileSize: z.number().int().min(1, "fileSize must be positive"),
  mimeType: z.string().optional().default("application/octet-stream"),
  totalChunks: z.number().int().min(1, "totalChunks must be at least 1"),
  clientHash: z.string().optional(),
});

// Cache completed document analysis in memory with user ownership tag
interface CachedAnalysis {
  userId: string;
  analysis: any;
}
const documentAnalysisCache = new Map<string, CachedAnalysis>();

// 1. POST /api/uploads/init
router.post("/uploads/init", async (req: Request, res: Response) => {
  const uid = await verifiedFirebaseUid(req, res, authMessages);
  if (!uid) return;

  const parsed = InitUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid upload initialization request",
      details: parsed.error.issues.map((i) => i.message),
    });
    return;
  }

  try {
    const { uploadId, session } = globalUploadEngine.initSession({
      fileName: parsed.data.fileName,
      fileSize: parsed.data.fileSize,
      mimeType: parsed.data.mimeType,
      totalChunks: parsed.data.totalChunks,
      clientHash: parsed.data.clientHash,
      userId: uid,
    });

    res.status(201).json({
      success: true,
      uploadId,
      fileName: session.fileName,
      fileSize: session.fileSize,
      totalChunks: session.totalChunks,
      status: session.status,
    });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || "Failed to initialize upload session" });
  }
});

// 2. PATCH /api/uploads/:uploadId/chunk
const rawParser = express.raw({ type: "*/*", limit: "20mb" });

router.patch("/uploads/:uploadId/chunk", rawParser, async (req: Request, res: Response) => {
  const uid = await verifiedFirebaseUid(req, res, authMessages);
  if (!uid) return;

  const uploadId = req.params.uploadId as string;
  const rawIndex = req.headers["x-chunk-index"];
  const checksum = req.headers["x-chunk-checksum"] as string | undefined;

  if (rawIndex === undefined) {
    res.status(400).json({ error: "Missing required 'x-chunk-index' header" });
    return;
  }

  const chunkIndex = parseInt(rawIndex as string, 10);
  if (isNaN(chunkIndex)) {
    res.status(400).json({ error: "Invalid 'x-chunk-index' header: must be an integer" });
    return;
  }

  const buffer = Buffer.isBuffer(req.body)
    ? req.body
    : typeof req.body === "string"
      ? Buffer.from(req.body)
      : Buffer.alloc(0);

  if (buffer.length === 0) {
    res.status(400).json({ error: "Empty chunk payload provided" });
    return;
  }

  try {
    const result = await globalUploadEngine.saveChunk({
      uploadId,
      userId: uid,
      chunkIndex,
      chunkBuffer: buffer,
      chunkChecksum: checksum,
    });

    res.status(200).json({
      success: true,
      uploadId,
      chunkIndex: result.chunkIndex,
      progressPercent: result.progressPercent,
      bytesUploaded: result.bytesUploaded,
    });
  } catch (err: any) {
    const isAuth = err?.message?.includes("Unauthorized");
    res.status(isAuth ? 403 : 400).json({ error: err?.message || "Failed to process chunk" });
  }
});

// 3. POST /api/uploads/:uploadId/complete
router.post("/uploads/:uploadId/complete", async (req: Request, res: Response) => {
  const uid = await verifiedFirebaseUid(req, res, authMessages);
  if (!uid) return;

  const uploadId = req.params.uploadId as string;
  const session = globalUploadEngine.getSession(uploadId);

  if (!session) {
    res.status(404).json({ error: `Upload session '${uploadId}' not found.` });
    return;
  }

  if (session.userId && session.userId !== uid) {
    res.status(403).json({ error: "Unauthorized: you do not have permission to assemble this session." });
    return;
  }

  try {
    const assembled = await globalUploadEngine.assembleFile(uploadId, uid);

    // Run document intelligence analysis on assembled file
    let analysis = null;
    try {
      analysis = await analyzeDocument(assembled.assembledPath, session.fileName, session.mimeType);
      documentAnalysisCache.set(uploadId, { userId: uid, analysis });
    } catch {}

    res.status(200).json({
      success: true,
      uploadId,
      fileName: session.fileName,
      totalBytes: assembled.totalBytes,
      sha256: assembled.sha256,
      status: "completed",
      analysis: analysis ? {
        totalWords: analysis.totalWords,
        totalChunks: analysis.totalChunks,
        executiveSummary: analysis.executiveSummary,
        keyEntities: analysis.keyEntities,
      } : null,
    });
  } catch (err: any) {
    const isAuth = err?.message?.includes("Unauthorized");
    res.status(isAuth ? 403 : 400).json({ error: err?.message || "Failed to assemble file" });
  }
});

// 4. GET /api/uploads/:uploadId/status
router.get("/uploads/:uploadId/status", async (req: Request, res: Response) => {
  const uid = await verifiedFirebaseUid(req, res, authMessages);
  if (!uid) return;

  const uploadId = req.params.uploadId as string;
  const session = globalUploadEngine.getSession(uploadId);

  if (!session) {
    res.status(404).json({ error: `Upload session '${uploadId}' not found.` });
    return;
  }

  if (session.userId && session.userId !== uid) {
    res.status(403).json({ error: "Unauthorized: you cannot view another user's upload session." });
    return;
  }

  const uploadedCount = session.uploadedChunks.size;
  const progressPercent = Math.round((uploadedCount / session.totalChunks) * 100);

  res.status(200).json({
    uploadId,
    fileName: session.fileName,
    fileSize: session.fileSize,
    totalChunks: session.totalChunks,
    uploadedChunks: Array.from(session.uploadedChunks).sort((a, b) => a - b),
    progressPercent,
    status: session.status,
    finalHash: session.finalHash,
  });
});

// 5. POST /api/uploads/:uploadId/query (Grounded Q&A with citations)
router.post("/uploads/:uploadId/query", async (req: Request, res: Response) => {
  const uid = await verifiedFirebaseUid(req, res, authMessages);
  if (!uid) return;

  const uploadId = req.params.uploadId as string;
  const query = req.body?.query;

  if (!query || typeof query !== "string") {
    res.status(400).json({ error: "Query string is required" });
    return;
  }

  const cached = documentAnalysisCache.get(uploadId);
  if (!cached) {
    res.status(404).json({ error: "Document intelligence analysis not found for this session." });
    return;
  }

  if (cached.userId !== uid) {
    res.status(403).json({ error: "Unauthorized: you do not have permission to query this document." });
    return;
  }

  const citations = queryDocumentGrounding(cached.analysis.chunks, query, 4);

  res.status(200).json({
    success: true,
    query,
    citations,
    groundedContext: citations.map((c) => `[Citation: ${c.pageOrSection}]: "${c.snippet}"`).join("\n\n"),
  });
});

// 6. DELETE /api/uploads/:uploadId
router.delete("/uploads/:uploadId", async (req: Request, res: Response) => {
  const uid = await verifiedFirebaseUid(req, res, authMessages);
  if (!uid) return;

  const uploadId = req.params.uploadId as string;
  const session = globalUploadEngine.getSession(uploadId);

  if (!session) {
    res.status(404).json({ error: `Upload session '${uploadId}' not found.` });
    return;
  }

  if (session.userId && session.userId !== uid) {
    res.status(403).json({ error: "Unauthorized: you cannot delete another user's upload session." });
    return;
  }

  try {
    globalUploadEngine.deleteSession(uploadId, uid);
    documentAnalysisCache.delete(uploadId);
    res.status(200).json({ success: true, message: `Session ${uploadId} cleaned up.` });
  } catch (err: any) {
    res.status(403).json({ error: err?.message || "Failed to delete session" });
  }
});

export default router;
