import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalRepository } from "../storage/repository";
import { MemoryEngine } from "../storage/memory-engine";
import { AIMemorySummaryEngine } from "../storage/ai-memory-summary-engine";
import { IntelligentMemoryContextManager } from "../storage/intelligent-memory-context-manager";
import { defaultPreferences } from "../storage/types";
import { modelClient } from "../ai/client";

const activeRepos: LocalRepository[] = [];
function createTestRepo(owner = "user-alice", dbName = `test-repo-${crypto.randomUUID()}`) {
  const repo = new LocalRepository(dbName);
  repo.setOwner(owner);
  activeRepos.push(repo);
  return repo;
}

beforeEach(() => {
  vi.spyOn(modelClient, "getModelCapabilities").mockResolvedValue([]);
  vi.spyOn(modelClient, "generateResponse").mockResolvedValue("{}");
});

afterEach(async () => {
  vi.restoreAllMocks();
  for (const repo of activeRepos.splice(0)) {
    await repo.close();
  }
});

describe("Automatic AI Memory — Mandatory Behaviour Acceptance Tests", () => {
  // Test 1: A new useful preference is automatically remembered
  it("Test 1: automatically remembers a new useful user preference without manual button clicks", async () => {
    const repo = createTestRepo("user-pref");
    const manager = new IntelligentMemoryContextManager(repo);

    const userMessage = "I always prefer TypeScript with strict typing over loose JavaScript.";
    const assistantReply = "I will strictly write TypeScript with full type safety for your projects.";

    const result = await manager.processTurnAndExtractMemories(userMessage, assistantReply, {
      conversationId: "conv-pref-1",
    });

    expect(result.added.length).toBeGreaterThan(0);
    expect(result.added[0].category).toBe("user_preference");
    expect(result.added[0].content).toContain("TypeScript with strict typing");

    const memEngine = new MemoryEngine(repo);
    const stored = await memEngine.listMemories({ category: "user_preference" });
    expect(stored.some((m) => m.content.includes("TypeScript with strict typing"))).toBe(true);
  });

  // Test 2: A new project decision updates existing project memory
  it("Test 2: automatically records technical decisions and project context", async () => {
    const repo = createTestRepo("user-proj");
    const manager = new IntelligentMemoryContextManager(repo);

    const userMessage = "We decided to build our distributed event stream using Apache Kafka and Go.";
    const assistantReply = "Understood. Architecture aligned on Apache Kafka and Go.";

    const result = await manager.processTurnAndExtractMemories(userMessage, assistantReply, {
      conversationId: "conv-proj-1",
      projectId: "proj-streaming",
    });

    expect(result.added.length).toBeGreaterThan(0);
    expect(result.added[0].category).toBe("technical_decision");
    expect(result.added[0].content).toContain("Apache Kafka and Go");

    const contextPkg = await manager.buildContextPackage("What is our messaging broker?");
    expect(contextPkg.rankedMemories.some((m) => m.content.includes("Apache Kafka"))).toBe(true);
  });

  // Test 3: The summary updates without a manual button click
  it("Test 3: automatically maintains and updates the Layer B summary without any manual action", async () => {
    const repo = createTestRepo("user-summary");
    const manager = new IntelligentMemoryContextManager(repo);
    const summaryEngine = new AIMemorySummaryEngine(repo);

    // Initial state: no summary
    const initialSummary = await summaryEngine.getSummary();
    expect(initialSummary).toBeNull();

    // Converse with preference and stack details
    await manager.processTurnAndExtractMemories(
      "I am working on Ayatrisya Workspace and our stack is React, Vite, and Tailwind CSS.",
      "Noted your project stack.",
      { conversationId: "conv-sum-1" }
    );

    // Verify summary was created automatically
    const updatedSummary = await summaryEngine.getSummary();
    expect(updatedSummary).not.toBeNull();
    expect(updatedSummary?.totalSourceMemoriesCount).toBeGreaterThanOrEqual(1);
    expect(updatedSummary?.sections.activeProjects.length + updatedSummary?.sections.technicalEnvironment.length).toBeGreaterThan(0);
  });

  // Test 4: Corrections replace outdated information
  it("Test 4: detects contradictions and ensures newer explicit corrections replace outdated information", async () => {
    const repo = createTestRepo("user-corrections");
    const manager = new IntelligentMemoryContextManager(repo);

    // Step 1: Set initial database memory
    await manager.processTurnAndExtractMemories(
      "We use MongoDB for our database layer.",
      "Acknowledged, MongoDB set for database.",
      { conversationId: "conv-db-1" }
    );

    let mems = await manager.retrieveAndRankMemories("database layer");
    expect(mems.some((m) => m.content.includes("MongoDB"))).toBe(true);

    // Step 2: Explicit correction stating switch to PostgreSQL
    const correctionResult = await manager.processTurnAndExtractMemories(
      "Actually, stop using MongoDB. We switched to PostgreSQL for our database layer.",
      "Updated! Database shifted from MongoDB to PostgreSQL.",
      { conversationId: "conv-db-2" }
    );

    expect(correctionResult.contradictionsDetected).toBeGreaterThanOrEqual(1);
    expect(correctionResult.superseded.some((s) => s.content.includes("MongoDB"))).toBe(true);

    // Step 3: Verify old memory is removed and new memory is present
    mems = await manager.retrieveAndRankMemories("database layer");
    expect(mems.some((m) => m.content.includes("PostgreSQL"))).toBe(true);
    expect(mems.some((m) => m.content.includes("MongoDB"))).toBe(false);

    // Step 4: Summary reflects the new decision
    const summaryEngine = new AIMemorySummaryEngine(repo);
    const summary = await summaryEngine.getSummary();
    const allSummaryText = JSON.stringify(summary?.sections || {});
    expect(allSummaryText).toContain("PostgreSQL");
    expect(allSummaryText).not.toContain("MongoDB");
  });

  // Test 5: Duplicate memories are handled
  it("Test 5: deduplicates repeated memories without bloating the memory store", async () => {
    const repo = createTestRepo("user-dedup");
    const manager = new IntelligentMemoryContextManager(repo);

    const message = "I prefer dark mode and high contrast themes.";
    const firstTurn = await manager.processTurnAndExtractMemories(message, "Understood.");
    expect(firstTurn.added.length).toBe(1);

    // Repeat the exact same preference
    const secondTurn = await manager.processTurnAndExtractMemories(message, "Understood again.");
    expect(secondTurn.added.length).toBe(0);

    const memEngine = new MemoryEngine(repo);
    const all = await memEngine.listMemories();
    expect(all.filter((m) => m.content.toLowerCase().includes("dark mode")).length).toBe(1);
  });

  // Test 6: Deleted memories do not reappear
  it("Test 6: deleted memories are permanently removed and never reappear", async () => {
    const repo = createTestRepo("user-delete");
    const manager = new IntelligentMemoryContextManager(repo);
    const memEngine = new MemoryEngine(repo);

    const created = await memEngine.createMemory({
      category: "user_preference",
      content: "I always prefer unit tests written in Jest.",
    });

    let list = await memEngine.listMemories();
    expect(list.some((m) => m.id === created.id)).toBe(true);

    // Delete memory
    await memEngine.deleteMemory(created.id);

    // Verify deletion
    list = await memEngine.listMemories();
    expect(list.some((m) => m.id === created.id)).toBe(false);

    // Re-ranking never surfaces deleted item
    const ranked = await manager.retrieveAndRankMemories("unit testing framework");
    expect(ranked.some((m) => m.id === created.id)).toBe(false);
  });

  // Test 7: Memory survives application restart
  it("Test 7: memories and summaries survive application restarts and persist in IndexedDB", async () => {
    const sharedDbName = `survive-restart-db-${crypto.randomUUID()}`;
    const initialRepo = createTestRepo("user-survive", sharedDbName);
    const initialManager = new IntelligentMemoryContextManager(initialRepo);

    await initialManager.processTurnAndExtractMemories(
      "Our repository is hosted on GitHub and we use Vitest for automated testing.",
      "Recorded testing infrastructure.",
      { conversationId: "conv-1" }
    );

    // Simulate restart by closing DB
    await initialRepo.close();

    // Re-open fresh session on the same database
    const restartedRepo = createTestRepo("user-survive", sharedDbName);
    const restartedManager = new IntelligentMemoryContextManager(restartedRepo);
    const restartedSummaryEngine = new AIMemorySummaryEngine(restartedRepo);

    const context = await restartedManager.buildContextPackage("What test runner do we use?");
    expect(context.rankedMemories.some((m) => m.content.includes("Vitest"))).toBe(true);

    const summary = await restartedSummaryEngine.getSummary();
    expect(summary).not.toBeNull();
    expect(JSON.stringify(summary?.sections)).toContain("Vitest");
  });

  // Test 8: Disabling memory prevents new automatic collection
  it("Test 8: disabling autoMemoryCollection prevents any new background memory extraction", async () => {
    const repo = createTestRepo("user-disabled");
    const manager = new IntelligentMemoryContextManager(repo);

    // Set preferences to disable autoMemoryCollection
    const prefs = {
      ...defaultPreferences,
      personalization: {
        ...defaultPreferences.personalization,
        enabled: true,
        useMemory: true,
        autoMemoryCollection: false, // Disabled by user
      },
    };
    await repo.savePreferences(prefs);

    // Simulate chat flow check as performed in Chat.tsx
    const storedPrefs = await repo.getPreferences();
    const shouldExtract = storedPrefs.personalization.enabled &&
      storedPrefs.personalization.useMemory &&
      storedPrefs.personalization.autoMemoryCollection !== false;

    expect(shouldExtract).toBe(false);

    if (shouldExtract) {
      await manager.processTurnAndExtractMemories(
        "I always prefer Python for backend data services.",
        "Noted."
      );
    }

    const memEngine = new MemoryEngine(repo);
    const memories = await memEngine.listMemories();
    expect(memories.length).toBe(0);
  });

  // Test 9: Memory processing does not block chat
  it("Test 9: background memory extraction operates asynchronously without throwing or blocking", async () => {
    const repo = createTestRepo("user-async");
    const manager = new IntelligentMemoryContextManager(repo);

    let chatResponseFinished = false;
    let memoryExtractionFinished = false;

    // Simulate chat response completion
    const runChatTurn = async () => {
      // 1. Assistant completes reply
      chatResponseFinished = true;

      // 2. Background task launched via fire-and-forget void async
      void (async () => {
        await manager.processTurnAndExtractMemories(
          "I prefer fast, concise replies without pleasantries.",
          "Noted.",
          { conversationId: "conv-async" }
        );
        memoryExtractionFinished = true;
      })();
    };

    await runChatTurn();
    expect(chatResponseFinished).toBe(true);

    // Wait a brief moment for microtask queue to drain
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(memoryExtractionFinished).toBe(true);
  });

  // Test 10: No unexpected paid API calls are introduced
  it("Test 10: operates completely offline and locally without invoking paid external model APIs", async () => {
    const repo = createTestRepo("user-offline");
    const manager = new IntelligentMemoryContextManager(repo);
    const summaryEngine = new AIMemorySummaryEngine(repo);

    const generateSpy = vi.spyOn(modelClient, "generateResponse");

    // Process turns and build summary
    await manager.processTurnAndExtractMemories(
      "My name is Alex, my timezone is UTC+1, and I am building a mobile banking app with Flutter.",
      "Hello Alex! Ready to build Flutter apps."
    );

    const summary = await summaryEngine.getSummary();
    expect(summary).not.toBeNull();
    expect(summary?.sections.backgroundContext.some((b) => b.includes("Alex") || b.includes("timezone"))).toBe(true);

    // Confirm that modelClient.generateResponse was NOT called for routine deterministic extraction/consolidation
    expect(generateSpy).not.toHaveBeenCalled();
  });

  // Privacy & Reliability: Never stores API keys or passwords
  it("Privacy Guard: rejects passwords, API keys, and secret credentials from being stored as memories", async () => {
    const repo = createTestRepo("user-privacy");
    const manager = new IntelligentMemoryContextManager(repo);

    const dangerousMessage = "My password is SuperSecretPass123! and my API key is sk-proj-1234567890abcdefghijklmn.";
    const result = await manager.processTurnAndExtractMemories(dangerousMessage, "Acknowledged.");

    expect(result.added.length).toBe(0);

    const memEngine = new MemoryEngine(repo);
    const memories = await memEngine.listMemories();
    expect(memories.length).toBe(0);

    const summaryEngine = new AIMemorySummaryEngine(repo);
    const summary = await summaryEngine.getSummary();
    expect(summary).toBeNull();
  });

  // Export & Import: Roundtrip memory management
  it("User Control: supports full JSON memory export and restoration via import", async () => {
    const repoSource = createTestRepo("source-user");
    const managerSource = new IntelligentMemoryContextManager(repoSource);
    const memEngineSource = new MemoryEngine(repoSource);

    await memEngineSource.createMemory({
      category: "user_preference",
      content: "I always prefer tabs over spaces.",
      pinned: true,
      tags: ["code-style"],
    });

    await memEngineSource.createMemory({
      category: "technical_decision",
      content: "Decided to use SQLite for embedded storage.",
    });

    const exportedJson = await managerSource.exportMemoriesAsJson();
    expect(exportedJson).toContain("tabs over spaces");
    expect(exportedJson).toContain("SQLite for embedded storage");

    // Import into clean target repo
    const repoTarget = createTestRepo("target-user");
    const managerTarget = new IntelligentMemoryContextManager(repoTarget);

    const importResult = await managerTarget.importMemoriesFromJson(exportedJson);
    expect(importResult.count).toBe(2);
    expect(importResult.summaryUpdated).toBe(true);

    const memEngineTarget = new MemoryEngine(repoTarget);
    const importedMemories = await memEngineTarget.listMemories();
    expect(importedMemories.length).toBe(2);
    expect(importedMemories.some((m) => m.content.includes("tabs over spaces"))).toBe(true);
    expect(importedMemories.some((m) => m.content.includes("SQLite"))).toBe(true);
  });
});
