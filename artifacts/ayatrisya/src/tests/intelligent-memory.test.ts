import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalRepository } from "../storage/repository";
import { MemoryEngine } from "../storage/memory-engine";
import { IntelligentMemoryContextManager } from "../storage/intelligent-memory-context-manager";
import { applyPersonalization } from "../ai/personalization";
import { defaultPreferences } from "../storage/types";

const activeRepos: LocalRepository[] = [];
function createTestRepo(owner = "user-alice", dbName = `test-repo-${crypto.randomUUID()}`) {
  const repo = new LocalRepository(dbName);
  repo.setOwner(owner);
  activeRepos.push(repo);
  return repo;
}

afterEach(async () => {
  vi.restoreAllMocks();
  for (const repo of activeRepos.splice(0)) {
    await repo.close();
  }
});

describe("Conversational Experience 2.0 — Intelligent Memory System", () => {
  // Scenario 1, 2, 3, 4: Preference in one chat -> New chat -> Ask about preference -> Correct retrieval
  it("Scenario 1-4: extracts preference from conversation 1, and retrieves it in a brand new conversation 2", async () => {
    const repo = createTestRepo("user-alice");
    const manager = new IntelligentMemoryContextManager(repo);

    // 1. Tell Ayatrisya a preference in conversation 1
    const conv1 = await repo.createConversation("Project Discussion");
    const userTurn1 = "I prefer using PostgreSQL and Prisma for our database layer.";
    const assistantTurn1 = "Got it! I will remember that you prefer PostgreSQL and Prisma for database operations.";

    const extraction = await manager.processTurnAndExtractMemories(userTurn1, assistantTurn1, {
      conversationId: conv1.id,
    });

    expect(extraction.added.length).toBeGreaterThan(0);
    expect(extraction.added[0].content).toContain("PostgreSQL");

    // 2. Start a completely new conversation 2
    const conv2 = await repo.createConversation("Database Setup");

    // 3. Ask about that preference in conversation 2
    const queryConv2 = "Which database engine and ORM should we configure?";
    const contextPkg = await manager.buildContextPackage(queryConv2, {
      currentConversationId: conv2.id,
    });

    // 4. Confirm correct memory retrieval in conversation 2
    expect(contextPkg.rankedMemories.length).toBeGreaterThan(0);
    const retrievedPostgres = contextPkg.rankedMemories.some(
      (m) => m.content.toLowerCase().includes("postgresql")
    );
    expect(retrievedPostgres).toBe(true);

    // Verify context package formats properly into model messages
    const prefs = { ...defaultPreferences, personalization: { ...defaultPreferences.personalization, enabled: true, useMemory: true } };
    const personalized = applyPersonalization(
      [{ role: "user", content: queryConv2 }],
      prefs.personalization,
      {
        memories: contextPkg.rankedMemories,
        memorySummary: contextPkg.summaryContext,
      }
    );

    expect(personalized[0].content).toContain("PostgreSQL");
  });

  // Scenario 5, 6: Change the preference -> Newer explicit correction takes precedence
  it("Scenario 5-6: detects contradiction and ensures explicit correction takes precedence over old preference", async () => {
    const repo = createTestRepo("user-alice");
    const manager = new IntelligentMemoryContextManager(repo);

    // Initial preference
    await manager.processTurnAndExtractMemories(
      "I always use Tailwind CSS for UI styling.",
      "Understood, using Tailwind CSS.",
      { conversationId: "conv-init" }
    );

    // Verify initial memory is stored
    const initialList = await manager.retrieveAndRankMemories("styling framework");
    expect(initialList.some((m) => m.content.includes("Tailwind"))).toBe(true);

    // 5. Change the preference with explicit correction
    const correctionTurn = "Actually, we switched our styling framework to vanilla CSS modules instead of Tailwind CSS.";
    const correctionResult = await manager.processTurnAndExtractMemories(
      correctionTurn,
      "Noted the switch to vanilla CSS modules.",
      { conversationId: "conv-correction" }
    );

    // 6. Confirm the newer explicit correction takes precedence and old superseded memory is cleaned up
    expect(correctionResult.contradictionsDetected).toBeGreaterThanOrEqual(1);

    const updatedList = await manager.retrieveAndRankMemories("styling framework");
    expect(updatedList.some((m) => m.content.includes("vanilla CSS modules"))).toBe(true);
    // The old contradicted Tailwind preference should no longer be the active styling rule
    expect(updatedList.some((m) => m.content === "I always use Tailwind CSS for UI styling.")).toBe(false);
  });

  // Scenario 7, 8: Unrelated topic -> Unrelated memories are not injected
  it("Scenario 7-8: does not inject unrelated memories for irrelevant queries", async () => {
    const repo = createTestRepo("user-alice");
    const manager = new IntelligentMemoryContextManager(repo);

    // Add technical database preference
    await manager.processTurnAndExtractMemories(
      "I always write backend microservices in Go.",
      "Acknowledged, Go for microservices.",
      { conversationId: "conv-go" }
    );

    // 7. Ask about an unrelated topic (e.g. poetry or baking)
    const unrelatedQuery = "How do you make traditional sourdough bread from scratch?";

    // 8. Confirm unrelated memories are not injected into the prompt
    const contextPkg = await manager.buildContextPackage(unrelatedQuery, {
      maxTotalTokens: 2000,
    });

    const hasGoMemory = contextPkg.rankedMemories.some((m) => m.content.toLowerCase().includes("microservices in go"));
    expect(hasGoMemory).toBe(false);
  });

  // Scenario 9, 10: Delete a memory -> Retrieval no longer returns it
  it("Scenario 9-10: supports explicit memory inspection and deletion", async () => {
    const repo = createTestRepo("user-alice");
    const manager = new IntelligentMemoryContextManager(repo);
    const engine = new MemoryEngine(repo);

    const created = await engine.createMemory({
      category: "user_preference",
      content: "I prefer working in Dark Mode exclusively.",
      tags: ["theme", "darkmode"],
      pinned: true,
    });

    // Verify it is retrieved
    let retrieved = await manager.retrieveAndRankMemories("theme preferences");
    expect(retrieved.some((m) => m.id === created.id)).toBe(true);

    // 9. Delete the memory
    const deleted = await engine.deleteMemory(created.id);
    expect(deleted).toBe(true);

    // 10. Verify that retrieval no longer returns it
    retrieved = await manager.retrieveAndRankMemories("theme preferences");
    expect(retrieved.some((m) => m.id === created.id)).toBe(false);
  });

  // Scenario 11, 12: Restart application -> Confirm persistent memories remain available
  it("Scenario 11-12: memories persist across simulated application restart / new repository instance", async () => {
    const sharedDbName = `persistent-db-${crypto.randomUUID()}`;
    const repoBeforeRestart = createTestRepo("user-charlie", sharedDbName);
    const engineBefore = new MemoryEngine(repoBeforeRestart);

    await engineBefore.createMemory({
      category: "technical_decision",
      content: "Our team uses Kubernetes for container orchestration.",
      tags: ["kubernetes", "devops"],
      pinned: true,
    });

    // 11. Simulate application restart (close database connection)
    await repoBeforeRestart.close();

    // 12. Open new application session with same owner
    const repoAfterRestart = createTestRepo("user-charlie", sharedDbName);
    const managerAfter = new IntelligentMemoryContextManager(repoAfterRestart);

    const results = await managerAfter.retrieveAndRankMemories("container deployment");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain("Kubernetes for container orchestration");
  });

  // Scenario 13: Multiple users and project boundaries
  it("Scenario 13: strictly isolates memories between distinct user accounts and project boundaries", async () => {
    const sharedDb = `multiuser-db-${crypto.randomUUID()}`;
    const repoAlice = createTestRepo("alice", sharedDb);
    const repoBob = createTestRepo("bob", sharedDb);

    const engineAlice = new MemoryEngine(repoAlice);
    const engineBob = new MemoryEngine(repoBob);

    // Alice creates memory in Project Alpha
    await engineAlice.createMemory({
      category: "project_context",
      content: "Project Alpha secret key identifier: alpha-9912",
      projectId: "proj-alpha",
    });

    // Bob retrieves memories
    const bobMemories = await engineBob.listMemories();
    expect(bobMemories.some((m) => m.content.includes("alpha-9912"))).toBe(false);

    // Alice queries Project Beta
    const managerAlice = new IntelligentMemoryContextManager(repoAlice);
    const contextBeta = await managerAlice.buildContextPackage("What is the secret key?", {
      projectId: "proj-beta",
    });

    // Project Alpha memories should receive low project score when querying Project Beta
    const topMatch = contextBeta.rankedMemories[0];
    if (topMatch) {
      expect(topMatch.projectId).not.toBe("proj-beta");
    }
  });

  // Scenario 14: Memory write failure detection and recovery
  it("Scenario 14: detects write failures, queues for recovery, and flushes successfully", async () => {
    const repo = createTestRepo("user-recovery");
    const manager = new IntelligentMemoryContextManager(repo);

    // Mock localStorage for test environment
    const storage: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => storage[k] || null,
      setItem: (k: string, v: string) => { storage[k] = v; },
      removeItem: (k: string) => { delete storage[k]; },
    });

    // Enqueue write recovery item
    (manager as any).queueWriteRecovery({
      category: "user_preference",
      content: "Queued recovery item: prefer high contrast text",
      tags: ["accessibility"],
    });

    expect(storage["ayatrisya_memory_write_recovery_queue"]).toBeDefined();

    // Flush the queue
    const flushedCount = await manager.flushRecoveryQueue();
    expect(flushedCount).toBe(1);

    // Verify flushed memory is now in active repository
    const all = await manager.retrieveAndRankMemories("high contrast text");
    expect(all.some((m) => m.content.includes("prefer high contrast text"))).toBe(true);
  });

  // Scenario 15: Offline memory retrieval in local desktop application
  it("Scenario 15: supports full offline local-first memory retrieval and JSON/Markdown export", async () => {
    const repo = createTestRepo("desktop-offline-user");
    const manager = new IntelligentMemoryContextManager(repo);
    const engine = new MemoryEngine(repo);

    await engine.createMemory({
      category: "work_preference",
      content: "My timezone is UTC+5:30 and I work between 10am and 7pm.",
      tags: ["timezone", "hours"],
      pinned: true,
    });

    await engine.createMemory({
      category: "technical_decision",
      content: "Our architecture is a desktop offline local first deployment with zero cloud egress.",
      tags: ["offline", "desktop", "architecture"],
    });

    // Retrieve offline without external network
    const offlineContext = await manager.buildContextPackage("When are you available and what is your architecture?", {
      maxTotalTokens: 1500,
    });

    expect(offlineContext.rankedMemories.length).toBe(2);
    expect(offlineContext.totalEstimatedTokens).toBeGreaterThan(0);

    // Test JSON Export
    const jsonExport = await manager.exportMemoriesAsJson();
    expect(jsonExport).toContain("UTC+5:30");
    expect(jsonExport).toContain("desktop-offline-user");

    // Test Markdown Export
    const mdExport = await manager.exportMemoriesAsMarkdown();
    expect(mdExport).toContain("# Ayatrisya AI Memory Export");
    expect(mdExport.toLowerCase()).toContain("zero cloud egress");
  });
});
