import { describe, it, expect, vi, beforeEach } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

const { ConnectionManager } = require("../../electron/desktop/remote/connection-manager.cjs");

describe("Desktop Remote Connection & Routing Policy", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ayatrisya-remote-test-"));
  });

  it("stores and lists endpoints with encrypted API keys redacted from listing", async () => {
    const cm = new ConnectionManager({ userDataDir: tmpDir });
    await cm.init();

    const id = await cm.saveEndpoint({
      name: "OpenAI Production",
      endpointUrl: "https://api.openai.com/v1",
      modelName: "gpt-4o",
      apiKey: "sk-proj-supersecretkey1234567890",
    });

    const list = cm.listEndpoints();
    expect(list.length).toBe(1);
    const item = list[0];
    expect(item.name).toBe("OpenAI Production");
    expect(item.endpointUrl).toBe("https://api.openai.com/v1");
    expect(item.hasApiKey).toBe(true);
    // Raw API key must NEVER be in listing
    expect((item as any).apiKey).toBeUndefined();
    expect((item as any).encryptedKey).toBeUndefined();

    // Verify persistence across reload
    const cmReloaded = new ConnectionManager({ userDataDir: tmpDir });
    await cmReloaded.init();
    expect(cmReloaded.listEndpoints().length).toBe(1);
    expect(cmReloaded.listEndpoints()[0].id).toBe(id);
  });

  it("rejects insecure remote endpoints and SSRF targets on save", async () => {
    const cm = new ConnectionManager({ userDataDir: tmpDir });
    await cm.init();

    // Unencrypted HTTP
    await expect(
      cm.saveEndpoint({
        name: "Insecure Remote",
        endpointUrl: "http://remote-api.example.com/v1",
      })
    ).rejects.toThrow(/HTTPS encryption/);

    // Cloud metadata SSRF
    await expect(
      cm.saveEndpoint({
        name: "Cloud Metadata",
        endpointUrl: "https://169.254.169.254/latest",
      })
    ).rejects.toThrow(/cloud metadata/);
  });

  it("probes remote endpoint and parses discovered models with latency measurement", async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/models")) {
        return {
          ok: true,
          json: async () => ({
            data: [{ id: "qwen-coder-32b" }, { id: "llama-3.3-70b" }],
          }),
        };
      }
      return { ok: false };
    });

    const cm = new ConnectionManager({ userDataDir: tmpDir, fetchFn: mockFetch });
    const res = await cm.testEndpoint({
      endpointUrl: "https://api.example.com/v1",
      apiKey: "test-token",
    });

    expect(res.success).toBe(true);
    expect(res.models).toEqual(["qwen-coder-32b", "llama-3.3-70b"]);
    expect(res.latencyMs).toBeGreaterThanOrEqual(0);
    expect(res.error).toBeNull();
  });

  it("checks Ayatrisya Gateway and verifies underlying chat model availability", async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("/health")) {
        return { ok: true, status: 200 };
      }
      if (url.endsWith("/api/models")) {
        // Backend chat model is available
        return {
          ok: true,
          json: async () => ({
            models: [{ id: "ayatrisya-v1-chat" }],
          }),
        };
      }
      return { ok: false, status: 404 };
    });

    const cm = new ConnectionManager({ userDataDir: tmpDir, fetchFn: mockFetch });
    const status = await cm.testAyatrisyaGateway({
      gatewayUrl: "https://gateway.example.com",
      token: "session-token",
    });

    expect(status.gatewayHealthy).toBe(true);
    expect(status.chatModelAvailable).toBe(true);
    expect(status.models).toEqual(["ayatrisya-v1-chat"]);
  });

  it("reports gateway healthy but chatModelAvailable false if models endpoint fails", async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("/health")) {
        return { ok: true, status: 200 };
      }
      if (url.endsWith("/api/models")) {
        // Chat backend server is down behind the proxy
        return { ok: false, status: 503 };
      }
      return { ok: false, status: 500 };
    });

    const cm = new ConnectionManager({ userDataDir: tmpDir, fetchFn: mockFetch });
    const status = await cm.testAyatrisyaGateway({
      gatewayUrl: "https://gateway.example.com",
    });

    expect(status.gatewayHealthy).toBe(true);
    expect(status.chatModelAvailable).toBe(false);
  });

  it("enforces explicit routing policy and prevents silent cloud fallback", async () => {
    const cm = new ConnectionManager({ userDataDir: tmpDir });
    await cm.init();

    // 1. local-only policy
    await cm.setRoutingPolicy("local-only");
    const routeLocal = cm.resolveRoute({ requestedRoute: "ayatrisya-cloud", isOnline: true });
    expect(routeLocal.route).toBe("local");
    expect(routeLocal.targetName).toBe("Local CPU Model");

    // 2. ask-each-time policy
    await cm.setRoutingPolicy("ask-each-time");
    const askRoute = cm.resolveRoute({ requestedRoute: null, isOnline: true });
    expect(askRoute.route).toBe("ask-each-time");
    expect(askRoute.requiresConsent).toBe(true);

    // 3. Offline handling
    expect(() => {
      cm.resolveRoute({ requestedRoute: "ayatrisya-cloud", isOnline: false });
    }).toThrow(/Network offline/);
  });
});
