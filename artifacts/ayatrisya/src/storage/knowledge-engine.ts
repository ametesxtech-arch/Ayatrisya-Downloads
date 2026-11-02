import type { LocalRepository } from "./repository";
import type {
  KnowledgeBase,
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgeRetrievalMatch,
} from "./types";
import { atomic } from "./resource-operations";

const timestamp = () => new Date().toISOString();

export interface CreateKnowledgeBaseParams {
  name: string;
  description?: string;
  tags?: string[];
}

export interface IngestDocumentParams {
  knowledgeBaseId: string;
  title: string;
  fileName: string;
  mimeType: string;
  fileBytes: Uint8Array;
}

/**
 * Text extraction utility for supported file formats.
 * Handles UTF-8 plain text, Markdown, CSV, JSON, and extracts printable text from basic documents.
 */
export function extractTextFromBytes(fileName: string, mimeType: string, bytes: Uint8Array): string {
  const ext = fileName.split(".").at(-1)?.toLowerCase() || "";

  // Plain text, Markdown, CSV, JSON, code files
  if (
    mimeType.startsWith("text/") ||
    ["txt", "md", "csv", "json", "ts", "tsx", "js", "py", "sql", "yaml", "yml"].includes(ext)
  ) {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes).trim();
  }

  // PDF Text Extractor (stream text extraction fallback)
  if (ext === "pdf" || mimeType === "application/pdf") {
    const raw = new TextDecoder("latin1").decode(bytes);
    const textPieces: string[] = [];

    // Extract text from standard PDF content streams (BT ... ET)
    const streamRegex = /BT[\s\S]*?ET/g;
    let match: RegExpExecArray | null;
    while ((match = streamRegex.exec(raw)) !== null) {
      const block = match[0];
      // Extract string literals in parentheses ( ... ) Tj or TJ
      const stringRegex = /\(([\s\S]*?)\)\s*(?:Tj|'|")/g;
      let strMatch: RegExpExecArray | null;
      while ((strMatch = stringRegex.exec(block)) !== null) {
        textPieces.push(strMatch[1]);
      }
    }

    if (textPieces.length > 0) {
      return textPieces.join(" ").replace(/\\([()\\])/g, "$1").trim();
    }

    // Fallback printable ASCII extraction if streams are compressed/obfuscated
    const cleanChars = raw.replace(/[^\x20-\x7E\n\r\t]/g, " ");
    const words = cleanChars.split(/\s+/).filter((w) => w.length > 3 && !w.startsWith("/"));
    return words.slice(0, 3000).join(" ");
  }

  // DOCX / OpenXML text extraction (XML tag stripping from word/document.xml stream)
  if (ext === "docx" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    // DOCX is a zip container containing word/document.xml. In a browser client without heavy unzip libraries,
    // we extract printable text inside XML paragraph and run tags (<w:t>...</w:t>).
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const wtRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
    const pieces: string[] = [];
    let wtMatch: RegExpExecArray | null;
    while ((wtMatch = wtRegex.exec(raw)) !== null) {
      pieces.push(wtMatch[1]);
    }
    if (pieces.length > 0) {
      return pieces.join(" ").trim();
    }
  }

  // Fallback UTF-8 decode
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes).trim();
}

/**
 * Chunks extracted text into overlapping windows for localized retrieval.
 */
export function chunkText(
  text: string,
  options: { chunkSizeChars?: number; chunkOverlapChars?: number } = {}
): Array<{ text: string; startCharIndex: number; endCharIndex: number; tokenCountEstimate: number }> {
  const chunkSize = options.chunkSizeChars ?? 800;
  const overlap = options.chunkOverlapChars ?? 150;
  const chunks: Array<{ text: string; startCharIndex: number; endCharIndex: number; tokenCountEstimate: number }> = [];

  if (!text.trim()) return [];

  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);

    // Try to break at a sentence or newline boundary if possible
    if (end < text.length) {
      const boundary = text.lastIndexOf("\n", end);
      if (boundary > start + chunkSize * 0.5) {
        end = boundary + 1;
      } else {
        const periodBoundary = text.lastIndexOf(". ", end);
        if (periodBoundary > start + chunkSize * 0.5) {
          end = periodBoundary + 2;
        }
      }
    }

    const chunkContent = text.slice(start, end).trim();
    if (chunkContent) {
      chunks.push({
        text: chunkContent,
        startCharIndex: start,
        endCharIndex: end,
        tokenCountEstimate: Math.ceil(chunkContent.length / 4),
      });
    }

    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

export class KnowledgeBaseEngine {
  constructor(private repo: LocalRepository) {}

  async createKnowledgeBase(params: CreateKnowledgeBaseParams): Promise<KnowledgeBase> {
    const name = params.name.trim();
    if (!name || name.length > 200) {
      throw new Error("Knowledge base name must be between 1 and 200 characters.");
    }

    const now = timestamp();
    const kb: KnowledgeBase = {
      id: crypto.randomUUID(),
      ownerId: this.repo.ownerId,
      name,
      description: (params.description || "").trim(),
      tags: params.tags ? params.tags.map((t) => t.trim().toLowerCase()).filter(Boolean) : [],
      documentCount: 0,
      totalBytes: 0,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };

    await atomic(this.repo, ["knowledgeBases"], async (tx) => {
      await tx.objectStore("knowledgeBases").put(kb);
    });

    return kb;
  }

  async listKnowledgeBases(options: { search?: string; includeArchived?: boolean } = {}): Promise<KnowledgeBase[]> {
    const owner = this.repo.ownerId;
    const all = await this.repo.all<KnowledgeBase>("knowledgeBases", owner);

    return all.filter((kb) => {
      if (!options.includeArchived && kb.isArchived) return false;
      if (options.search) {
        const q = options.search.trim().toLowerCase();
        const matchesName = kb.name.toLowerCase().includes(q);
        const matchesDesc = kb.description.toLowerCase().includes(q);
        const matchesTags = kb.tags.some((t) => t.includes(q));
        if (!matchesName && !matchesDesc && !matchesTags) return false;
      }
      return true;
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getKnowledgeBase(id: string): Promise<KnowledgeBase | undefined> {
    return this.repo.get<KnowledgeBase>("knowledgeBases", id);
  }

  async updateKnowledgeBase(id: string, patch: { name?: string; description?: string; tags?: string[]; isArchived?: boolean }): Promise<KnowledgeBase> {
    return atomic(this.repo, ["knowledgeBases"], async (tx, owner) => {
      const existing = (await tx.objectStore("knowledgeBases").get([owner, id])) as KnowledgeBase | undefined;
      if (!existing) throw new Error("Knowledge Base not found.");

      const updated: KnowledgeBase = {
        ...existing,
        name: patch.name !== undefined ? patch.name.trim() : existing.name,
        description: patch.description !== undefined ? patch.description.trim() : existing.description,
        tags: patch.tags ? patch.tags.map((t) => t.trim().toLowerCase()).filter(Boolean) : existing.tags,
        isArchived: patch.isArchived !== undefined ? patch.isArchived : existing.isArchived,
        updatedAt: timestamp(),
      };

      if (!updated.name || updated.name.length > 200) {
        throw new Error("Knowledge base name must be between 1 and 200 characters.");
      }

      await tx.objectStore("knowledgeBases").put(updated);
      return updated;
    });
  }

  async deleteKnowledgeBase(id: string): Promise<boolean> {
    return atomic(this.repo, ["knowledgeBases", "knowledgeDocuments", "knowledgeChunks"], async (tx, owner) => {
      const existing = await tx.objectStore("knowledgeBases").get([owner, id]);
      if (!existing) return false;

      // Delete associated chunks
      const chunkKeys = await tx.objectStore("knowledgeChunks").index("knowledgeBaseId").getAllKeys([owner, id]);
      for (const k of chunkKeys) await tx.objectStore("knowledgeChunks").delete(k);

      // Delete associated docs
      const docKeys = await tx.objectStore("knowledgeDocuments").index("knowledgeBaseId").getAllKeys([owner, id]);
      for (const k of docKeys) await tx.objectStore("knowledgeDocuments").delete(k);

      // Delete KB
      await tx.objectStore("knowledgeBases").delete([owner, id]);
      return true;
    });
  }

  /**
   * Ingest a document, extract text, and index chunks atomically.
   */
  async ingestDocument(params: IngestDocumentParams): Promise<{ document: KnowledgeDocument; chunks: KnowledgeChunk[] }> {
    const kb = await this.getKnowledgeBase(params.knowledgeBaseId);
    if (!kb) throw new Error("Knowledge Base not found.");

    if (params.fileBytes.byteLength <= 0) {
      throw new Error("Cannot ingest empty document.");
    }
    if (params.fileBytes.byteLength > 10 * 1024 * 1024) {
      throw new Error("Document exceeds the 10 MB limit.");
    }

    const ext = params.fileName.split(".").at(-1)?.toLowerCase() || "txt";
    const extractedText = extractTextFromBytes(params.fileName, params.mimeType, params.fileBytes);
    if (!extractedText.trim()) {
      throw new Error("Could not extract readable text from this document.");
    }

    const rawChunks = chunkText(extractedText);
    const now = timestamp();
    const docId = crypto.randomUUID();

    const document: KnowledgeDocument = {
      id: docId,
      ownerId: this.repo.ownerId,
      knowledgeBaseId: kb.id,
      title: params.title.trim() || params.fileName,
      fileName: params.fileName,
      fileExtension: ext,
      mimeType: params.mimeType,
      fileSize: params.fileBytes.byteLength,
      extractedText,
      chunkCount: rawChunks.length,
      createdAt: now,
      updatedAt: now,
    };

    const chunks: KnowledgeChunk[] = rawChunks.map((c, idx) => ({
      id: crypto.randomUUID(),
      ownerId: this.repo.ownerId,
      knowledgeBaseId: kb.id,
      documentId: docId,
      chunkIndex: idx,
      text: c.text,
      tokenCountEstimate: c.tokenCountEstimate,
      startCharIndex: c.startCharIndex,
      endCharIndex: c.endCharIndex,
      metadata: {
        documentTitle: document.title,
        fileName: document.fileName,
      },
      createdAt: now,
      updatedAt: now,
    }));

    await atomic(this.repo, ["knowledgeBases", "knowledgeDocuments", "knowledgeChunks"], async (tx, owner) => {
      await tx.objectStore("knowledgeDocuments").put(document);
      for (const ch of chunks) {
        await tx.objectStore("knowledgeChunks").put(ch);
      }

      // Update KB stats
      const currentKb = (await tx.objectStore("knowledgeBases").get([owner, kb.id])) as KnowledgeBase;
      if (currentKb) {
        currentKb.documentCount += 1;
        currentKb.totalBytes += document.fileSize;
        currentKb.updatedAt = now;
        await tx.objectStore("knowledgeBases").put(currentKb);
      }
    });

    return { document, chunks };
  }

  async listDocuments(knowledgeBaseId: string): Promise<KnowledgeDocument[]> {
    const owner = this.repo.ownerId;
    const db = await this.repo.db();
    return db.getAllFromIndex("knowledgeDocuments", "knowledgeBaseId", [owner, knowledgeBaseId]);
  }

  async deleteDocument(documentId: string): Promise<boolean> {
    return atomic(this.repo, ["knowledgeBases", "knowledgeDocuments", "knowledgeChunks"], async (tx, owner) => {
      const doc = (await tx.objectStore("knowledgeDocuments").get([owner, documentId])) as KnowledgeDocument | undefined;
      if (!doc) return false;

      // Delete chunks for this doc
      const chunkKeys = await tx.objectStore("knowledgeChunks").index("documentId").getAllKeys([owner, documentId]);
      for (const k of chunkKeys) await tx.objectStore("knowledgeChunks").delete(k);

      await tx.objectStore("knowledgeDocuments").delete([owner, documentId]);

      // Update KB stats
      const kb = (await tx.objectStore("knowledgeBases").get([owner, doc.knowledgeBaseId])) as KnowledgeBase | undefined;
      if (kb) {
        kb.documentCount = Math.max(0, kb.documentCount - 1);
        kb.totalBytes = Math.max(0, kb.totalBytes - doc.fileSize);
        kb.updatedAt = timestamp();
        await tx.objectStore("knowledgeBases").put(kb);
      }
      return true;
    });
  }

  /**
   * Fast, reliable lexical / BM25-style keyword search over Knowledge Base chunks.
   * Provides genuine, traceable citations to source document titles and locations.
   */
  async searchKnowledgeBase(
    knowledgeBaseId: string,
    query: string,
    options: { maxMatches?: number } = {}
  ): Promise<KnowledgeRetrievalMatch[]> {
    const maxMatches = options.maxMatches ?? 5;
    const owner = this.repo.ownerId;
    const db = await this.repo.db();
    const chunks = (await db.getAllFromIndex("knowledgeChunks", "knowledgeBaseId", [owner, knowledgeBaseId])) as KnowledgeChunk[];

    if (chunks.length === 0) return [];

    const terms = query
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 2);

    if (terms.length === 0) return [];

    const matches: KnowledgeRetrievalMatch[] = [];

    for (const chunk of chunks) {
      let score = 0;
      const lower = chunk.text.toLowerCase();
      const titleLower = chunk.metadata.documentTitle.toLowerCase();

      for (const term of terms) {
        // Document title match
        if (titleLower.includes(term)) score += 3;

        // Content occurrence count
        let pos = 0;
        let count = 0;
        while ((pos = lower.indexOf(term, pos)) !== -1) {
          count++;
          pos += term.length;
          if (count > 10) break;
        }
        score += count * 2;
      }

      if (score > 0) {
        const citation = `[Source: "${chunk.metadata.documentTitle}" (${chunk.metadata.fileName}, chunk ${chunk.chunkIndex + 1})]`;
        matches.push({ chunk, score, citation });
      }
    }

    return matches.sort((a, b) => b.score - a.score).slice(0, maxMatches);
  }
}

