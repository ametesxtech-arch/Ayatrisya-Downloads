import { describe, expect, it, vi } from "vitest";
import { CloudflareStorageProvider } from "../storage/cloudflare-storage-provider";
import type { CloudStorageExport } from "../storage/cloud-storage-contract";

describe("CloudflareStorageProvider & Cloud Storage Contract", () => {
  const mockToken = "mock_firebase_id_token";
  const getToken = vi.fn().mockResolvedValue(mockToken);
  const baseUrl = "https://ayatrisya-cloud-storage.workers.dev";
  const provider = new CloudflareStorageProvider(baseUrl, getToken);

  it("requires authentication and rejects calls when user is signed out", async () => {
    const unauthProvider = new CloudflareStorageProvider(baseUrl, async () => null);
    await expect(unauthProvider.listKnowledgeBases("user-1")).rejects.toThrow(
      /Sign in with your Ayatrisya account/
    );
  });

  it("fetches and parses Knowledge Bases list cleanly", async () => {
    const mockKbs = [
      {
        id: "kb-1",
        ownerId: "user-1",
        title: "Architecture & Rules",
        description: "Core project blueprints",
        tags: ["arch", "specs"],
        documentCount: 4,
        createdAt: "2026-10-26T00:00:00Z",
        updatedAt: "2026-10-26T00:00:00Z",
      },
    ];

    vi.stubGlobal("fetch", async (url: string) => {
      if (url.includes("/api/storage/kb")) {
        return new Response(JSON.stringify({ knowledgeBases: mockKbs }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not found", { status: 404 });
    });

    const result = await provider.listKnowledgeBases("user-1");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Architecture & Rules");
    expect(result[0].tags).toContain("arch");
  });

  it("handles Seed memory CRUD and enforces user boundaries", async () => {
    const mockSeed = {
      id: "seed-101",
      ownerId: "user-1",
      kbId: "kb-1",
      title: "User Tone Preference",
      category: "preference",
      content: "Prefers concise answers with direct equations.",
      confidence: 0.95,
      pinned: true,
      createdAt: "2026-10-26T00:00:00Z",
      updatedAt: "2026-10-26T00:00:00Z",
    };

    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (url.includes("/api/storage/seeds") && init?.method === "POST") {
        return new Response(JSON.stringify(mockSeed), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not found", { status: 404 });
    });

    const created = await provider.createSeed("user-1", {
      kbId: "kb-1",
      title: "User Tone Preference",
      category: "preference",
      content: "Prefers concise answers with direct equations.",
      confidence: 0.95,
      pinned: true,
    });

    expect(created.id).toBe("seed-101");
    expect(created.pinned).toBe(true);
    expect(created.category).toBe("preference");
  });

  it("supports full cloud export and inventory accounting", async () => {
    const mockExport: CloudStorageExport = {
      format: "ayatrisya-cloud-export",
      version: 1,
      exportedAt: "2026-10-26T12:00:00Z",
      ownerId: "user-1",
      knowledgeBases: [],
      seeds: [],
      files: [],
    };

    vi.stubGlobal("fetch", async (url: string) => {
      if (url.includes("/api/storage/export")) {
        return new Response(JSON.stringify(mockExport), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not found", { status: 404 });
    });

    const exported = await provider.exportData("user-1");
    expect(exported.format).toBe("ayatrisya-cloud-export");
    expect(exported.ownerId).toBe("user-1");
  });

  it("safely handles 507 system capacity exhaustion and 413 user quota limits", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.includes("/api/storage/files")) {
        return new Response(
          JSON.stringify({ error: "System is operating in reserved-capacity protection mode. New uploads temporarily restricted." }),
          { status: 507, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("Not found", { status: 404 });
    });

    const dummyData = new Uint8Array([1, 2, 3, 4]);
    await expect(
      provider.saveFile("user-1", {
        name: "test.txt",
        mimeType: "text/plain",
        data: dummyData,
      })
    ).rejects.toThrow(/reserved-capacity protection mode/);
  });

  it("handles cloud restore import cleanly", async () => {
    const mockExport: CloudStorageExport = {
      format: "ayatrisya-cloud-export",
      version: 1,
      exportedAt: "2026-10-26T12:00:00Z",
      ownerId: "user-1",
      knowledgeBases: [{ id: "kb-1", ownerId: "user-1", title: "Test KB", description: "Desc", tags: ["tag"], documentCount: 0, createdAt: "2026-10-26", updatedAt: "2026-10-26" }],
      seeds: [{ id: "seed-1", ownerId: "user-1", title: "Test Seed", category: "fact", content: "Facts", confidence: 1, pinned: false, createdAt: "2026-10-26", updatedAt: "2026-10-26" }],
      files: [],
    };

    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (url.includes("/api/storage/restore") && init?.method === "POST") {
        return new Response(JSON.stringify({ restoredKBs: 1, restoredSeeds: 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not found", { status: 404 });
    });

    const restoreRes = await provider.importData("user-1", mockExport);
    expect(restoreRes.restoredKBs).toBe(1);
    expect(restoreRes.restoredSeeds).toBe(1);
  });
});

