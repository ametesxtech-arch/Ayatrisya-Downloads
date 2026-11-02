import type { LocalRepository } from "./repository";
import type {
  KnowledgeBase,
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgeSeedManifest,
  KnowledgeSeedPackage,
  MemoryEntry,
} from "./types";
import { atomic } from "./resource-operations";

const timestamp = () => new Date().toISOString();

/**
 * SHA-256 calculation for verifying Seed integrity.
 */
export async function calculateSha256(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface ExportSeedParams {
  name: string;
  description?: string;
  knowledgeBaseIds: string[];
  includeMemories?: boolean;
  memoryIds?: string[];
}

export class SeedEngine {
  constructor(private repo: LocalRepository) {}

  /**
   * Export selected Knowledge Bases and explicit user memories into a tamper-evident, portable Seed.
   */
  async exportSeed(params: ExportSeedParams): Promise<{ seedJson: string; manifest: KnowledgeSeedManifest }> {
    const owner = this.repo.ownerId;
    const db = await this.repo.db();

    // 1. Fetch targeted Knowledge Bases
    const allKbs = (await db.getAllFromIndex("knowledgeBases", "ownerId", owner)) as KnowledgeBase[];
    const selectedKbs = allKbs.filter((kb) => params.knowledgeBaseIds.includes(kb.id));

    // 2. Fetch associated documents and chunks
    const documents: KnowledgeDocument[] = [];
    const chunks: KnowledgeChunk[] = [];

    for (const kb of selectedKbs) {
      const docs = (await db.getAllFromIndex("knowledgeDocuments", "knowledgeBaseId", [owner, kb.id])) as KnowledgeDocument[];
      documents.push(...docs);

      const chs = (await db.getAllFromIndex("knowledgeChunks", "knowledgeBaseId", [owner, kb.id])) as KnowledgeChunk[];
      chunks.push(...chs);
    }

    // 3. Fetch explicit memories if requested
    let memories: MemoryEntry[] = [];
    if (params.includeMemories) {
      const allMemories = (await db.getAllFromIndex("aiMemories", "ownerId", owner)) as MemoryEntry[];
      if (params.memoryIds && params.memoryIds.length > 0) {
        memories = allMemories.filter((m) => params.memoryIds!.includes(m.id));
      } else {
        memories = allMemories.filter((m) => !m.temporary); // Do not export temporary/scratch memories
      }
    }

    const payloadWithoutChecksum = {
      knowledgeBases: selectedKbs,
      documents,
      chunks,
      memories,
    };

    const payloadString = JSON.stringify(payloadWithoutChecksum);
    const checksumSha256 = await calculateSha256(payloadString);

    const manifest: KnowledgeSeedManifest = {
      format: "ayatrisya-seed",
      seedVersion: "1.0",
      id: crypto.randomUUID(),
      name: params.name.trim(),
      description: (params.description || "").trim(),
      createdAt: timestamp(),
      exportedBy: owner,
      checksumSha256,
      itemCounts: {
        knowledgeBases: selectedKbs.length,
        documents: documents.length,
        chunks: chunks.length,
        memories: memories.length,
      },
    };

    const completePackage: KnowledgeSeedPackage = {
      manifest,
      ...payloadWithoutChecksum,
    };

    return {
      seedJson: JSON.stringify(completePackage, null, 2),
      manifest,
    };
  }

  /**
   * Validates and inspects an untrusted Seed JSON string without modifying any state.
   */
  async inspectSeed(seedJson: string): Promise<{ valid: boolean; manifest?: KnowledgeSeedManifest; error?: string }> {
    try {
      if (!seedJson || seedJson.length > 50 * 1024 * 1024) {
        return { valid: false, error: "Seed file is empty or exceeds the 50 MB limit." };
      }

      const parsed = JSON.parse(seedJson) as KnowledgeSeedPackage;
      if (!parsed || typeof parsed !== "object" || !parsed.manifest) {
        return { valid: false, error: "Invalid Seed package structure." };
      }

      if (parsed.manifest.format !== "ayatrisya-seed" || parsed.manifest.seedVersion !== "1.0") {
        return { valid: false, error: "Unsupported Seed format or version." };
      }

      // Recompute and verify cryptographic checksum
      const payloadWithoutChecksum = {
        knowledgeBases: parsed.knowledgeBases || [],
        documents: parsed.documents || [],
        chunks: parsed.chunks || [],
        memories: parsed.memories || [],
      };
      const computedSha256 = await calculateSha256(JSON.stringify(payloadWithoutChecksum));

      if (computedSha256 !== parsed.manifest.checksumSha256) {
        return {
          valid: false,
          error: "Seed integrity verification failed (SHA-256 mismatch). File may be corrupted or altered.",
        };
      }

      return { valid: true, manifest: parsed.manifest };
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : "Malformed Seed JSON." };
    }
  }

  /**
   * Imports an audited Seed into the active user's local database.
   * Maps IDs safely and binds all records strictly to repo.ownerId.
   */
  async importSeed(
    seedJson: string,
    options: { duplicateStrategy?: "remap_ids" | "merge" } = {}
  ): Promise<{ importedBases: number; importedDocuments: number; importedMemories: number }> {
    const inspection = await this.inspectSeed(seedJson);
    if (!inspection.valid || !inspection.manifest) {
      throw new Error(`Cannot import Seed: ${inspection.error}`);
    }

    const pkg = JSON.parse(seedJson) as KnowledgeSeedPackage;
    const owner = this.repo.ownerId;
    const now = timestamp();
    const strategy = options.duplicateStrategy || "remap_ids";

    // Map old IDs to new IDs to prevent collision across users or workspaces
    const idMap = new Map<string, string>();
    const getId = (oldId: string) => {
      if (strategy === "merge") return oldId;
      if (!idMap.has(oldId)) idMap.set(oldId, crypto.randomUUID());
      return idMap.get(oldId)!;
    };

    return atomic(this.repo, ["knowledgeBases", "knowledgeDocuments", "knowledgeChunks", "aiMemories"], async (tx) => {
      let importedBases = 0;
      let importedDocuments = 0;
      let importedMemories = 0;

      // Sanitize paths and names to prevent path traversal or script injection
      for (const doc of pkg.documents || []) {
        if (!doc.fileName || /[\/\\]|\.\./.test(doc.fileName)) {
          // Normalize file name safely removing directory paths
          doc.fileName = (doc.fileName || "document.txt").replace(/.*[\/\\]/, "").replace(/\.\./g, "");
        }
      }

      // Import KBs
      for (const kb of pkg.knowledgeBases || []) {
        const newId = getId(kb.id);
        const importedKb: KnowledgeBase = {
          ...kb,
          id: newId,
          ownerId: owner,
          name: strategy === "remap_ids" ? `${kb.name} (Imported)` : kb.name,
          updatedAt: now,
        };
        await tx.objectStore("knowledgeBases").put(importedKb);
        importedBases++;
      }

      // Import Documents
      for (const doc of pkg.documents || []) {
        const newDocId = getId(doc.id);
        const newKbId = getId(doc.knowledgeBaseId);
        const importedDoc: KnowledgeDocument = {
          ...doc,
          id: newDocId,
          knowledgeBaseId: newKbId,
          ownerId: owner,
          updatedAt: now,
        };
        await tx.objectStore("knowledgeDocuments").put(importedDoc);
        importedDocuments++;
      }

      // Import Chunks
      for (const ch of pkg.chunks || []) {
        const newChunkId = getId(ch.id);
        const newDocId = getId(ch.documentId);
        const newKbId = getId(ch.knowledgeBaseId);
        const importedChunk: KnowledgeChunk = {
          ...ch,
          id: newChunkId,
          documentId: newDocId,
          knowledgeBaseId: newKbId,
          ownerId: owner,
          updatedAt: now,
        };
        await tx.objectStore("knowledgeChunks").put(importedChunk);
      }

      // Import Memories
      for (const mem of pkg.memories || []) {
        const newMemId = getId(mem.id);
        const importedMem: MemoryEntry = {
          ...mem,
          id: newMemId,
          ownerId: owner,
          updatedAt: now,
        };
        await tx.objectStore("aiMemories").put(importedMem);
        importedMemories++;
      }

      return { importedBases, importedDocuments, importedMemories };
    });
  }
}

