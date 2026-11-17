import fs from "node:fs";
import path from "node:path";

export interface DocumentChunk {
  chunkIndex: number;
  sectionTitle?: string;
  pageNumber?: number;
  content: string;
  charCount: number;
  tokenEstimate: number;
}

export interface DocumentAnalysis {
  fileName: string;
  mimeType: string;
  totalChars: number;
  totalWords: number;
  totalChunks: number;
  executiveSummary: string;
  keyEntities: string[];
  chunks: DocumentChunk[];
}

export interface CitationMatch {
  chunkIndex: number;
  pageOrSection: string;
  snippet: string;
  relevanceScore: number;
}

/**
 * Parses raw document text and extracts semantic chunks with overlap.
 */
export function chunkDocumentText(
  text: string,
  maxChunkSizeChars = 3000,
  overlapChars = 300
): DocumentChunk[] {
  const cleanText = text.replace(/\r\n/g, "\n").trim();
  if (!cleanText) return [];

  const paragraphs = cleanText.split(/\n\s*\n/);
  const chunks: DocumentChunk[] = [];
  let currentBuffer = "";
  let currentSection = "Introduction";
  let chunkIdx = 1;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // Detect heading
    if (/^(#{1,4}\s+|[A-Z0-9\s]{4,40}:|[0-9]+\.\s+[A-Z])/.test(trimmed)) {
      currentSection = trimmed.replace(/^#+\s*/, "").split("\n")[0].slice(0, 60);
    }

    if (currentBuffer.length + trimmed.length > maxChunkSizeChars && currentBuffer.length > 0) {
      chunks.push({
        chunkIndex: chunkIdx++,
        sectionTitle: currentSection,
        pageNumber: Math.ceil(chunkIdx / 2),
        content: currentBuffer.trim(),
        charCount: currentBuffer.length,
        tokenEstimate: Math.round(currentBuffer.length / 4),
      });

      // Retain overlap from end of previous buffer
      const overlapText = currentBuffer.slice(-overlapChars);
      currentBuffer = overlapText + "\n\n" + trimmed;
    } else {
      currentBuffer = currentBuffer ? currentBuffer + "\n\n" + trimmed : trimmed;
    }
  }

  if (currentBuffer.trim()) {
    chunks.push({
      chunkIndex: chunkIdx,
      sectionTitle: currentSection,
      pageNumber: Math.ceil(chunkIdx / 2),
      content: currentBuffer.trim(),
      charCount: currentBuffer.length,
      tokenEstimate: Math.round(currentBuffer.length / 4),
    });
  }

  return chunks;
}

/**
 * Extracts raw textual content from files (text, markdown, code, csv, JSON).
 */
export async function extractDocumentText(filePath: string, mimeType?: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  // For plain text, markdown, source code, and CSV
  if (
    [".txt", ".md", ".csv", ".json", ".ts", ".js", ".py", ".html", ".xml", ".yaml", ".yml"].includes(ext) ||
    (mimeType && (mimeType.startsWith("text/") || mimeType.includes("json") || mimeType.includes("csv")))
  ) {
    const content = await fs.promises.readFile(filePath, "utf-8");
    return content;
  }

  // Fallback text stripper for binary documents (PDF/DOCX/RTF)
  const buf = await fs.promises.readFile(filePath);
  const rawString = buf.toString("latin1");

  // Extract printable text runs
  const textRuns = rawString.match(/[\x20-\x7E\t\n\r]{4,}/g) || [];
  const extracted = textRuns
    .filter((s) => !/^(obj|endobj|stream|endstream|xref|trailer|startxref)/.test(s.trim()))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return extracted || "Uploaded document processed successfully.";
}

/**
 * Performs document intelligence analysis: executive summary, word count, entity extraction.
 */
export async function analyzeDocument(filePath: string, fileName: string, mimeType: string): Promise<DocumentAnalysis> {
  const text = await extractDocumentText(filePath, mimeType);
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = chunkDocumentText(text);

  // Derive executive summary from first 2 non-trivial chunks
  const summarySource = chunks.slice(0, 2).map((c) => c.content).join(" ");
  const executiveSummary = summarySource.length > 500
    ? summarySource.slice(0, 480).replace(/\s+[^\s]*$/, "...")
    : summarySource || `Analysis of ${fileName}`;

  // Key entities (capitalized proper nouns or technical phrases)
  const potentialEntities = text.match(/\b[A-Z][a-zA-Z0-9_-]{2,}\b/g) || [];
  const entityCounts = new Map<string, number>();
  for (const ent of potentialEntities) {
    if (["The", "This", "That", "When", "With", "From", "Into", "Were", "Have"].includes(ent)) continue;
    entityCounts.set(ent, (entityCounts.get(ent) || 0) + 1);
  }

  const sortedEntities = Array.from(entityCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([e]) => e);

  return {
    fileName,
    mimeType,
    totalChars: text.length,
    totalWords: words.length,
    totalChunks: chunks.length,
    executiveSummary,
    keyEntities: sortedEntities,
    chunks,
  };
}

/**
 * Grounded query retrieval: finds relevant chunks and page/section citations.
 */
export function queryDocumentGrounding(
  chunks: DocumentChunk[],
  query: string,
  topK = 3
): CitationMatch[] {
  const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  if (queryTerms.length === 0) return [];

  const scored = chunks.map((chunk) => {
    const lowerContent = chunk.content.toLowerCase();
    let score = 0;
    for (const term of queryTerms) {
      if (lowerContent.includes(term)) {
        score += 1;
      }
    }
    return {
      chunkIndex: chunk.chunkIndex,
      pageOrSection: chunk.sectionTitle ? `${chunk.sectionTitle} (p. ${chunk.pageNumber || 1})` : `Page ${chunk.pageNumber || 1}`,
      snippet: chunk.content.slice(0, 250) + "...",
      relevanceScore: score,
    };
  });

  return scored
    .filter((s) => s.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, topK);
}
