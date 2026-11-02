import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalRepository } from "../storage/repository";
import { MemoryEngine } from "../storage/memory-engine";
import { KnowledgeBaseEngine, chunkText, extractTextFromBytes } from "../storage/knowledge-engine";
import { SeedEngine, calculateSha256 } from "../storage/seed-engine";
import { applyPersonalization } from "../ai/personalization";
import { defaultPreferences } from "../storage/types";

const active: LocalRepository[] = [];
function local(owner = "user-alice") {
  const repo = new LocalRepository(`test-${crypto.randomUUID()}`);
  repo.setOwner(owner);
  active.push(repo);
  return repo;
}

afterEach(async () => {
  vi.restoreAllMocks();
  for (const repo of active.splice(0)) await repo.close();
});

describe("Phase 4: AI Memory Engine", () => {
  it("creates, retrieves, edits, and deletes structured memories with user isolation", async () => {
    const repoAlice = local("alice");
    const repoBob = local("bob");
    const memAlice = new MemoryEngine(repoAlice);
    const memBob = new MemoryEngine(repoBob);

    // Alice creates memory
    const created = await memAlice.createMemory({
      content: "Prefer Python over JavaScript for backend algorithms",
      category: "technical_decision",
      tags: ["python", "algorithms"],
      pinned: true,
    });

    expect(created.id).toBeDefined();
    expect(created.pinned).toBe(true);
    expect(created.category).toBe("technical_decision");

    // Alice can retrieve it
    const fetched = await memAlice.getMemory(created.id);
    expect(fetched?.content).toBe("Prefer Python over JavaScript for backend algorithms");

    // Bob CANNOT see Alice's memory (Strict user boundary isolation)
    const bobList = await memBob.listMemories();
    expect(bobList.some((m) => m.id === created.id)).toBe(false);
    const bobFetch = await memBob.getMemory(created.id);
    expect(bobFetch).toBeUndefined();

    // Alice updates memory
    const updated = await memAlice.updateMemory(created.id, {
      content: "Prefer Rust over Python for performance-critical algorithms",
      pinned: false,
    });
    expect(updated.content).toBe("Prefer Rust over Python for performance-critical algorithms");
    expect(updated.pinned).toBe(false);

    // Alice deletes memory
    const deleted = await memAlice.deleteMemory(created.id);
    expect(deleted).toBe(true);
    expect(await memAlice.getMemory(created.id)).toBeUndefined();
  });

  it("filters expired temporary memories and retrieves relevant bounded context", async () => {
    const repo = local("charlie");
    const mem = new MemoryEngine(repo);

    // Memory that already expired yesterday
    const pastDate = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    await mem.createMemory({
      content: "Temporary session scratch note",
      category: "conversation_fact",
      temporary: true,
      expiresAt: pastDate,
    });

    // Active memory
    await mem.createMemory({
      content: "Database schema uses PostgreSQL UUID primary keys",
      category: "technical_decision",
      tags: ["database", "postgresql", "uuid"],
      pinned: true,
    });

    // Active memory for unrelated topic
    await mem.createMemory({
      content: "Favorite coffee roast is Ethiopian medium",
      category: "user_preference",
    });

    // Listing should exclude expired by default
    const activeList = await mem.listMemories();
    expect(activeList.length).toBe(2);
    expect(activeList.some((m) => m.content.includes("scratch note"))).toBe(false);

    // Query retrieval matching keywords
    const retrieved = await mem.retrieveContext("How do we design the PostgreSQL database schema?");
    expect(retrieved.length).toBeGreaterThanOrEqual(1);
    expect(retrieved[0].content).toContain("PostgreSQL UUID");
  });
});

describe("Phase 4: Knowledge Base Engine & Lexical Search", () => {
  it("chunks text documents cleanly across sentence and line boundaries", () => {
    const text = "First sentence about distributed consensus.\nSecond sentence explaining Paxos and Raft.\nThird sentence detailing Byzantine fault tolerance.";
    const chunks = chunkText(text, { chunkSizeChars: 60, chunkOverlapChars: 15 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.text.length).toBeGreaterThan(0);
      expect(c.tokenCountEstimate).toBeGreaterThan(0);
    }
  });

  it("extracts text, ingests document, and performs BM25-style search with authentic citations", async () => {
    const repo = local("dave");
    const kbEngine = new KnowledgeBaseEngine(repo);

    const kb = await kbEngine.createKnowledgeBase({
      name: "Engineering Architecture Docs",
      description: "Core microservice protocols and consensus specifications",
    });
    expect(kb.id).toBeDefined();

    const sampleDocContent = `Ayatrisya Distributed Storage Protocol
Section 1.1: Quorum and Consensus
All read operations require a simple majority quorum across storage nodes.
Write operations enforce strict quorum confirmation before returning acknowledgement.`;

    const bytes = new TextEncoder().encode(sampleDocContent);
    const { document, chunks } = await kbEngine.ingestDocument({
      knowledgeBaseId: kb.id,
      title: "Storage Protocol Specification",
      fileName: "storage-spec.txt",
      mimeType: "text/plain",
      fileBytes: bytes,
    });

    expect(document.chunkCount).toBeGreaterThan(0);
    expect(chunks.length).toBeGreaterThan(0);

    // Search Knowledge Base
    const matches = await kbEngine.searchKnowledgeBase(kb.id, "quorum read operations");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].chunk.text).toContain("majority quorum");
    expect(matches[0].citation).toContain("Storage Protocol Specification");
    expect(matches[0].citation).toContain("storage-spec.txt");
  });
});

describe("Phase 4: Portable Knowledge Seeds", () => {
  it("exports a tamper-evident Seed package with SHA-256 checksum and imports into clean state", async () => {
    const repoSender = local("sender");
    const kbEngine = new KnowledgeBaseEngine(repoSender);
    const memEngine = new MemoryEngine(repoSender);
    const seedEngine = new SeedEngine(repoSender);

    const kb = await kbEngine.createKnowledgeBase({
      name: "Distributed Systems Guide",
      description: "Educational material on replication",
    });

    await kbEngine.ingestDocument({
      knowledgeBaseId: kb.id,
      title: "Raft Overview",
      fileName: "raft.md",
      mimeType: "text/markdown",
      fileBytes: new TextEncoder().encode("# Raft Consensus Algorithm\nLeader election and log replication."),
    });

    await memEngine.createMemory({
      content: "Always explain distributed systems using consensus analogies",
      category: "user_preference",
    });

    // Export Seed
    const { seedJson, manifest } = await seedEngine.exportSeed({
      name: "Systems Seed",
      knowledgeBaseIds: [kb.id],
      includeMemories: true,
    });

    expect(manifest.format).toBe("ayatrisya-seed");
    expect(manifest.checksumSha256).toBeDefined();
    expect(manifest.itemCounts.knowledgeBases).toBe(1);
    expect(manifest.itemCounts.documents).toBe(1);

    // Inspect Seed
    const inspection = await seedEngine.inspectSeed(seedJson);
    expect(inspection.valid).toBe(true);

    // Test Tamper Resistance: Mutating content breaks checksum
    const tampered = JSON.parse(seedJson);
    tampered.knowledgeBases[0].name = "Tampered Knowledge Base";
    const tamperedJson = JSON.stringify(tampered);
    const badInspection = await seedEngine.inspectSeed(tamperedJson);
    expect(badInspection.valid).toBe(false);
    expect(badInspection.error).toContain("integrity verification failed");

    // Receiver imports valid Seed
    const repoReceiver = local("receiver");
    const receiverSeedEngine = new SeedEngine(repoReceiver);
    const importResult = await receiverSeedEngine.importSeed(seedJson);

    expect(importResult.importedBases).toBe(1);
    expect(importResult.importedDocuments).toBe(1);
    expect(importResult.importedMemories).toBe(1);

    // Verify records exist under receiver's ownerId
    const receiverKbEngine = new KnowledgeBaseEngine(repoReceiver);
    const receiverKbs = await receiverKbEngine.listKnowledgeBases();
    expect(receiverKbs.length).toBe(1);
    expect(receiverKbs[0].ownerId).toBe("receiver");
  });
});

describe("Phase 4: Model Prompt Context Grounding", () => {
  it("injects retrieved memories and knowledge passages into user turn without leaking fake citations", () => {
    const messages = [{ role: "user" as const, content: "How should I structure the API models?" }];

    const customized = applyPersonalization(messages, defaultPreferences.personalization, {
      memories: [{ content: "Use strict Zod schemas for all request validations", category: "technical_decision" }],
      knowledgePassages: [{ text: "All API routes must parse payloads with Zod.", citation: '[Source: "Architecture Guide"]' }],
    });

    expect(customized[0].content).toContain("Active User & Project Context");
    expect(customized[0].content).toContain("Use strict Zod schemas");
    expect(customized[0].content).toContain("Retrieved Knowledge Base Documents");
    expect(customized[0].content).toContain('[Source: "Architecture Guide"]');
    expect(customized[0].content).toContain("Ground your response in the retrieved source documents");
  });
});

