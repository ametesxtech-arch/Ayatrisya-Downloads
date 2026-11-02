import { describe, it, expect, vi, beforeEach } from "vitest";

// Import CJS modules
const { OllamaAdapter } = require("../../electron/desktop/runtime/ollama-adapter.cjs");
const { LlamaAdapter } = require("../../electron/desktop/runtime/llama-adapter.cjs");
const { ActiveModelManager } = require("../../electron/desktop/runtime/active-manager.cjs");
const { assertLoopbackAddress, validateRemoteEndpointSecurity, redactDiagnosticData } = require("../../electron/desktop/security/policy.cjs");

describe("Desktop Runtime Adapters & Active Manager", () => {
  describe("Security Policy", () => {
    it("asserts loopback addresses and rejects remote addresses", () => {
      expect(() => assertLoopbackAddress("http://127.0.0.1:11434")).not.toThrow();
      expect(() => assertLoopbackAddress("http://localhost:8080")).not.toThrow();
      expect(() => assertLoopbackAddress("http://192.168.1.50:8080")).toThrow(/exclusive.*loopback/i);
      expect(() => assertLoopbackAddress("https://example.com")).toThrow(/exclusive.*loopback/i);
    });

    it("validates remote endpoints and prevents SSRF", () => {
      // Loopback allowed with HTTP
      const local = validateRemoteEndpointSecurity("http://127.0.0.1:11434");
      expect(local.valid).toBe(true);
      expect(local.isLocal).toBe(true);

      // Remote allowed with HTTPS
      const remote = validateRemoteEndpointSecurity("https://api.openai.com/v1");
      expect(remote.valid).toBe(true);
      expect(remote.isLocal).toBe(false);

      // Remote HTTP rejected
      const unencrypted = validateRemoteEndpointSecurity("http://api.openai.com/v1");
      expect(unencrypted.valid).toBe(false);
      expect(unencrypted.error).toMatch(/HTTPS encryption/);

      // Cloud metadata SSRF rejected
      const metadata = validateRemoteEndpointSecurity("https://169.254.169.254/latest/meta-data");
      expect(metadata.valid).toBe(false);
      expect(metadata.error).toMatch(/cloud metadata/);

      // Private RFC 1918 rejected on remote
      const privateNet = validateRemoteEndpointSecurity("https://10.0.0.1/v1");
      expect(privateNet.valid).toBe(false);
      expect(privateNet.error).toMatch(/private network/);
    });

    it("redacts tokens, api keys, and passwords from diagnostic data", () => {
      const sensitive = "Authorization: Bearer eyJhbGciOiJIUz... and key sk-1234567890abcdef and password: \"mysecret123\"";
      const sanitized = redactDiagnosticData(sensitive);
      expect(sanitized).not.toContain("eyJhbGciOiJIUz");
      expect(sanitized).toContain("[REDACTED_TOKEN]");
      expect(sanitized).not.toContain("abcdef");
      expect(sanitized).toContain("[REDACTED_KEY]");
      expect(sanitized).not.toContain("mysecret123");
      expect(sanitized).toContain("[REDACTED_PASSWORD]");
    });
  });

  describe("OllamaAdapter", () => {
    it("handles health check and tag listing", async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith("/api/tags")) {
          return {
            ok: true,
            json: async () => ({
              models: [{ name: "qwen2.5:1.5b" }, { name: "deepseek-r1:1.5b" }],
            }),
          };
        }
        return { ok: false };
      });

      const adapter = new OllamaAdapter({
        endpoint: "http://127.0.0.1:11434",
        fetchFn: mockFetch,
      });

      const healthy = await adapter.checkHealth();
      expect(healthy).toBe(true);

      const models = await adapter.listInstalledModels();
      expect(models).toEqual(["qwen2.5:1.5b", "deepseek-r1:1.5b"]);
    });

    it("performs chat completion and returns standard metrics", async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string, options: any) => {
        if (url.endsWith("/api/chat")) {
          return {
            ok: true,
            json: async () => ({
              message: { role: "assistant", content: "Ayatrisya is operational." },
              prompt_eval_count: 12,
              eval_count: 24,
            }),
          };
        }
        return { ok: false };
      });

      const adapter = new OllamaAdapter({ fetchFn: mockFetch });
      const result = await adapter.chatCompletion({
        model: "qwen2.5:1.5b",
        messages: [{ role: "user", content: "Status report?" }],
      });

      expect(result.content).toBe("Ayatrisya is operational.");
      expect(result.usage.completionTokens).toBe(24);
      expect(result.tokensPerSec).toBeGreaterThanOrEqual(0);
    });
  });

  describe("ActiveModelManager", () => {
    let mockStorage: any;
    let mockLlamaAdapter: any;
    let mockOllamaAdapter: any;

    beforeEach(() => {
      mockStorage = {
        isInstalled: vi.fn().mockResolvedValue(true),
        getModelFilePath: vi.fn().mockResolvedValue("C:/mock/models/qwen-1.5b.gguf"),
      };

      mockLlamaAdapter = {
        endpoint: "http://127.0.0.1:49384",
        start: vi.fn().mockResolvedValue({ state: "READY" }),
        stop: vi.fn().mockResolvedValue({ state: "STOPPED" }),
        chatCompletion: vi.fn().mockResolvedValue({
          content: "Llama response",
          role: "assistant",
          latencyMs: 150,
          usage: { totalTokens: 20 },
        }),
      };

      mockOllamaAdapter = {
        endpoint: "http://127.0.0.1:11434",
        checkHealth: vi.fn().mockResolvedValue(true),
        chatCompletion: vi.fn().mockResolvedValue({
          content: "Ollama response",
          role: "assistant",
          latencyMs: 120,
          usage: { totalTokens: 18 },
        }),
      };
    });

    it("enforces memory limit and rejects models exceeding available RAM", async () => {
      const mockProfiler = {
        profileSystem: vi.fn().mockResolvedValue({
          availableRamGb: 3.5, // only 3.5 GB available
          recommendedThreads: 4,
        }),
      };

      const manager = new ActiveModelManager({
        storageManager: mockStorage,
        hardwareProfiler: mockProfiler,
        llamaAdapter: mockLlamaAdapter,
      });

      const largeModel = {
        id: "qwen-2.5-7b-instruct-q4_k_m",
        name: "Qwen 2.5 7B",
        minRamGb: 8.0, // requires 8 GB
        recommendedRuntime: "llama-cpp",
      };

      await expect(
        manager.loadModel("qwen-2.5-7b-instruct-q4_k_m", largeModel)
      ).rejects.toThrow(/Insufficient RAM/);

      expect(manager.getStatus().status).toBe("ERROR");
    });

    it("unloads previous model when a new model is requested (single active model invariant)", async () => {
      const manager = new ActiveModelManager({
        storageManager: mockStorage,
        llamaAdapter: mockLlamaAdapter,
      });

      const modelA = { id: "model-a", name: "Model A", recommendedRuntime: "llama-cpp" };
      const modelB = { id: "model-b", name: "Model B", recommendedRuntime: "llama-cpp" };

      await manager.loadModel("model-a", modelA);
      expect(manager.getStatus().activeModelId).toBe("model-a");
      expect(manager.getStatus().status).toBe("READY");

      // Load model B -> must trigger unload of model A
      await manager.loadModel("model-b", modelB);
      expect(mockLlamaAdapter.stop).toHaveBeenCalled();
      expect(manager.getStatus().activeModelId).toBe("model-b");
    });

    it("dispatches chat to the active runtime and recovers if generation fails", async () => {
      const manager = new ActiveModelManager({
        storageManager: mockStorage,
        llamaAdapter: mockLlamaAdapter,
      });

      const modelA = { id: "model-a", name: "Model A", recommendedRuntime: "llama-cpp" };
      await manager.loadModel("model-a", modelA);

      const reply = await manager.chat({
        messages: [{ role: "user", content: "Hello" }],
      });
      expect(reply.content).toBe("Llama response");

      // If adapter throws a crash error
      mockLlamaAdapter.chatCompletion.mockRejectedValueOnce(
        new Error("connect ECONNREFUSED 127.0.0.1:49384")
      );

      await expect(
        manager.chat({ messages: [{ role: "user", content: "Crash test" }] })
      ).rejects.toThrow(/ECONNREFUSED/);

      expect(manager.getStatus().status).toBe("ERROR");
      expect(manager.getStatus().error).toMatch(/Runtime crash/);
    });
  });
});
