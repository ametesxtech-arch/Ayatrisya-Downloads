import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalRepository } from "../storage/repository";
import { MemoryEngine } from "../storage/memory-engine";
import { AIMemorySummaryEngine } from "../storage/ai-memory-summary-engine";
import { applyPersonalization } from "../ai/personalization";
import { defaultPreferences } from "../storage/types";
import { exportBackup, restoreBackup } from "../storage/backup";
import { modelClient } from "../ai/client";

const active: LocalRepository[] = [];
function local(owner = "user-alice") {
  const repo = new LocalRepository(`test-mem-summary-${crypto.randomUUID()}`);
  repo.setOwner(owner);
  active.push(repo);
  return repo;
}

beforeEach(() => {
  vi.spyOn(modelClient, "getModelCapabilities").mockResolvedValue([]);
});

afterEach(async () => {
  vi.restoreAllMocks();
  for (const repo of active.splice(0)) await repo.close();
});

describe("Ayatrisya AI Memory Summary Engine (Two-Layer Architecture)", () => {
  it("stores preferences in Layer A and synthesizes Layer B 8-section summary", async () => {
    const repo = local("test-user-1");
    const memEngine = new MemoryEngine(repo);
    const summaryEngine = new AIMemorySummaryEngine(repo);

    // Layer A detailed memories
    await memEngine.createMemory({
      category: "user_preference",
      content: "Prefers concise TypeScript code without verbose commentary",
      tags: ["code-style", "typescript"],
      importance: 4,
      confidence: 0.95,
    });

    await memEngine.createMemory({
      category: "technical_decision",
      content: "Adopted Tailwind CSS and React 18 for all frontend interfaces",
      tags: ["stack", "frontend"],
      importance: 5,
      confidence: 1.0,
    });

    await memEngine.createMemory({
      category: "project_context",
      content: "Working on Ayatrisya Cloud multi-tenant AI workspace platform",
      tags: ["project", "ayatrisya"],
      importance: 5,
      confidence: 0.9,
    });

    // Synthesize Layer B summary
    const summary = await summaryEngine.generateSummary();
    expect(summary).toBeDefined();
    expect(summary.version).toBeGreaterThanOrEqual(1);
    expect(summary.totalSourceMemoriesCount).toBe(3);

    // Verify presence of items across structured 8 sections
    expect(summary.sections.preferencesAndStyle.length).toBeGreaterThan(0);
    expect(summary.sections.importantDecisions.length).toBeGreaterThan(0);
    expect(summary.sections.activeProjects.length).toBeGreaterThan(0);

    // Verify prompt formatting
    const formatted = summaryEngine.formatSummaryForPrompt(summary);
    expect(formatted).toContain("User Preferences & Style");
    expect(formatted).toContain("Key Architectural & Technical Decisions");
    expect(formatted).toContain("Active Projects");
  });

  it("updates Layer B summary when conversation turns introduce new facts and preference shifts", async () => {
    const repo = local("test-user-shifts");
    const summaryEngine = new AIMemorySummaryEngine(repo);

    // Turn 1: Initial preference stated in chat
    await summaryEngine.processNewTurn(
      "I am currently building an e-commerce dashboard using Vue 3 and Pinia.",
      "Got it! I will assist you with Vue 3 and Pinia architecture.",
      "conv-1"
    );

    let summary = await summaryEngine.getSummary();
    expect(summary).not.toBeNull();
    const joinedProjects = summary?.sections.activeProjects.join(" ") || "";
    expect(joinedProjects.toLowerCase()).toContain("e-commerce");

    // Turn 2: Preference shift
    await summaryEngine.processNewTurn(
      "Actually, I decided to switch the framework to React with TanStack Query instead of Vue.",
      "Understood! We are switching from Vue to React with TanStack Query.",
      "conv-1"
    );

    summary = await summaryEngine.getSummary();
    const joinedTech = summary?.sections.technicalEnvironment.join(" ") || "";
    const joinedDecisions = summary?.sections.importantDecisions.join(" ") || "";
    expect(joinedTech.toLowerCase() + joinedDecisions.toLowerCase()).toContain("react");
  });

  it("merges duplicate facts and prevents repetitive noise in the summary", async () => {
    const repo = local("test-user-duplicates");
    const summaryEngine = new AIMemorySummaryEngine(repo);

    // Repeated statements across turns
    await summaryEngine.processNewTurn(
      "Always write unit tests with Vitest",
      "I will ensure all unit tests use Vitest.",
      "conv-1"
    );

    await summaryEngine.processNewTurn(
      "Remember to write unit tests with Vitest",
      "Yes, all tests will use Vitest.",
      "conv-2"
    );

    const summary = await summaryEngine.getSummary();
    expect(summary).not.toBeNull();
    const vitestEntries = summary?.sections.constraintsAndInstructions.filter((c) =>
      c.toLowerCase().includes("vitest")
    ) || [];
    // Should be consolidated rather than repeated 10 times
    expect(vitestEntries.length).toBeLessThanOrEqual(2);
  });

  it("allows user to edit summary overview and persists modifications atomically", async () => {
    const repo = local("test-user-edit");
    const summaryEngine = new AIMemorySummaryEngine(repo);

    await summaryEngine.saveSummary({
      overview: "Senior fullstack engineer focused on clean architecture and high test coverage.",
      sections: {
        preferencesAndStyle: ["Direct, concise, no conversational filler"],
        backgroundContext: ["Enterprise SaaS systems"],
        activeProjects: ["Ayatrisya AI"],
        technicalEnvironment: ["Node.js, TypeScript, PostgreSQL"],
        goalsAndPlans: ["Ship v2 release by end of month"],
        importantDecisions: ["Use IndexedDB local-first storage"],
        ongoingTasks: ["Finalize memory summary UI"],
        constraintsAndInstructions: ["Preserve strict tenant isolation"],
      },
    });

    let fetched = await summaryEngine.getSummary();
    expect(fetched?.overview).toBe("Senior fullstack engineer focused on clean architecture and high test coverage.");
    expect(fetched?.sections.ongoingTasks[0]).toBe("Finalize memory summary UI");

    // User updates overview
    await summaryEngine.saveSummary({
      overview: "Staff Principal Engineer and open source contributor.",
      isAiGenerated: false,
    });

    fetched = await summaryEngine.getSummary();
    expect(fetched?.overview).toBe("Staff Principal Engineer and open source contributor.");
    expect(fetched?.isAiGenerated).toBe(false);
    expect(fetched?.sections.ongoingTasks[0]).toBe("Finalize memory summary UI");
  });

  it("enforces strict owner boundary isolation between users", async () => {
    const repoAlice = local("alice-identity");
    const repoBob = local("bob-identity");

    const summaryAlice = new AIMemorySummaryEngine(repoAlice);
    const summaryBob = new AIMemorySummaryEngine(repoBob);

    await summaryAlice.saveSummary({
      overview: "Alice's Secret Project Data",
      sections: {
        preferencesAndStyle: ["Alice's style"],
        backgroundContext: [],
        activeProjects: ["Alice Project Alpha"],
        technicalEnvironment: [],
        goalsAndPlans: [],
        importantDecisions: [],
        ongoingTasks: [],
        constraintsAndInstructions: [],
      },
    });

    // Bob tries to get summary
    const bobSummary = await summaryBob.getSummary();
    expect(bobSummary).toBeNull();

    // Alice gets her summary
    const aliceSummary = await summaryAlice.getSummary();
    expect(aliceSummary?.overview).toBe("Alice's Secret Project Data");
  });

  it("deleting summary or wiping memory immediately stops prompt context injection", async () => {
    const repo = local("test-delete-memory");
    const summaryEngine = new AIMemorySummaryEngine(repo);
    const memEngine = new MemoryEngine(repo);

    await memEngine.createMemory({
      category: "user_preference",
      content: "Secret user preference: always reply in Spanish",
    });

    await summaryEngine.saveSummary({
      overview: "User speaks Spanish primarily",
    });

    let summary = await summaryEngine.getSummary();
    expect(summary).not.toBeNull();

    // Verify context injection
    const promptWithMemory = applyPersonalization(
      [{ role: "user", content: "Hello" }],
      { ...defaultPreferences.personalization, enabled: true, useMemory: true },
      {
        memorySummary: summaryEngine.formatSummaryForPrompt(summary!),
      }
    );
    expect(promptWithMemory[0].content).toContain("User speaks Spanish primarily");

    // Now clear memory system
    await summaryEngine.clearAllMemorySystem();

    summary = await summaryEngine.getSummary();
    expect(summary).toBeNull();
    const remainingMemories = await memEngine.listMemories();
    expect(remainingMemories.length).toBe(0);

    // Verify context injection is clean
    const promptAfterWipe = applyPersonalization(
      [{ role: "user", content: "Hello" }],
      { ...defaultPreferences.personalization, enabled: true, useMemory: true },
      {
        memorySummary: summary ? summaryEngine.formatSummaryForPrompt(summary) : "",
      }
    );
    expect(promptAfterWipe[0].content).not.toContain("User speaks Spanish primarily");
  });

  it("exports and imports aiMemorySummaries in backup package", async () => {
    const repoSource = local("user-export");
    const repoTarget = local("user-import");

    const summarySource = new AIMemorySummaryEngine(repoSource);
    await summarySource.saveSummary({
      overview: "Exported summary profile",
      sections: {
        preferencesAndStyle: ["Keep responses clean"],
        backgroundContext: [],
        activeProjects: ["Export Test"],
        technicalEnvironment: [],
        goalsAndPlans: [],
        importantDecisions: [],
        ongoingTasks: [],
        constraintsAndInstructions: [],
      },
    });

    // Export backup
    const blob = await exportBackup(repoSource);
    const text = await blob.text();
    expect(text).toContain("Exported summary profile");

    // Restore into target
    const result = await restoreBackup(text, "replace", repoTarget);
    expect(result.imported).toBeGreaterThan(0);

    const summaryTarget = new AIMemorySummaryEngine(repoTarget);
    const importedSummary = await summaryTarget.getSummary();
    expect(importedSummary?.overview).toBe("Exported summary profile");
    expect(importedSummary?.sections.activeProjects).toContain("Export Test");
  });
});

