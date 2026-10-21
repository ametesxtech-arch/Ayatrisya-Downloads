import { describe, expect, it, vi } from "vitest";
import { AyatrisyaModelClient } from "../ai/client";
import type { VerifiedDesktopRuntime } from "../desktop/runtime";

const noLocalModel: VerifiedDesktopRuntime = {
  api: { getLocalModelEndpoint: vi.fn().mockResolvedValue("") } as unknown as VerifiedDesktopRuntime["api"],
  info: {
    bridgeName: "ayatrisya-desktop",
    apiVersion: 1,
    appVersion: "1.0.0",
    platform: "linux",
    capabilities: ["local-model-ipc"],
    localModel: { endpointConfigured: false, models: [] },
  },
};

describe("shared inference request jobs", () => {
  it("runs a real local adapter request and marks its request job complete", async () => {
    const api = {
      getLocalModelEndpoint: vi.fn().mockResolvedValue("http://127.0.0.1:1234"),
      requestLocalModel: vi.fn().mockImplementation(async (path: string) => ({
        status: 200,
        contentType: "application/json",
        body: path === "/capabilities"
          ? { models: [{ id: "v1-fast", available: true, streaming: false, modalities: ["chat"] }] }
          : { text: "local response" },
      })),
      cancelLocalModelRequest: vi.fn().mockResolvedValue(undefined),
    };
    const runtime: VerifiedDesktopRuntime = {
      api: api as unknown as VerifiedDesktopRuntime["api"],
      info: {
        ...noLocalModel.info,
        localModel: { endpointConfigured: true, models: [{ id: "v1-fast", available: true, modalities: ["chat"] }] },
      },
    };
    const tokenProvider = vi.fn();
    const client = new AyatrisyaModelClient(tokenProvider, vi.fn().mockResolvedValue(runtime));
    const job = client.submitJob({
      kind: "chat",
      messages: [{ role: "user", content: "Hello" }],
      options: { model: "v1-fast", mode: "Normal" },
    });
    expect(client.getJobStatus(job.id)?.state).toBe("running");
    await expect(job.result).resolves.toBe("local response");
    expect(client.getJobStatus(job.id)).toMatchObject({ state: "completed", kind: "chat" });
    expect(api.requestLocalModel.mock.calls.map(([path]) => path)).toEqual(["/capabilities", "/chat"]);
    expect(tokenProvider).not.toHaveBeenCalled();
  });

  it("tracks a real request from running to failed without retaining prompt data", async () => {
    const client = new AyatrisyaModelClient(
      vi.fn(),
      vi.fn().mockResolvedValue(noLocalModel),
    );
    const job = client.submitJob({
      kind: "chat",
      messages: [{ role: "user", content: "private prompt" }],
      options: { model: "v1-fast", mode: "Normal" },
    });
    expect(client.getJobStatus(job.id)?.state).toBe("running");
    await expect(job.result).rejects.toThrow("No local model is configured");
    expect(client.getJobStatus(job.id)).toMatchObject({ state: "failed", kind: "chat" });
    expect(JSON.stringify(client.getJobStatus(job.id))).not.toContain("private prompt");
  });

  it("cancels an in-flight request while the verified desktop runtime is resolving", async () => {
    let resolveRuntime!: (runtime: VerifiedDesktopRuntime) => void;
    const runtimePromise = new Promise<VerifiedDesktopRuntime>((resolve) => { resolveRuntime = resolve; });
    const client = new AyatrisyaModelClient(vi.fn(), vi.fn(() => runtimePromise));
    const job = client.submitJob({
      kind: "chat",
      messages: [{ role: "user", content: "keep local" }],
      options: { model: "v1-fast", mode: "Normal" },
    });
    expect(client.cancelJob(job.id)).toBe(true);
    resolveRuntime(noLocalModel);
    await expect(job.result).rejects.toMatchObject({ name: "AbortError" });
    expect(client.getJobStatus(job.id)).toMatchObject({ state: "cancelled", kind: "chat" });
    expect(client.cancelJob(job.id)).toBe(false);
  });
});
