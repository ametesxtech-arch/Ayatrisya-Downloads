import { describe, expect, it, vi } from "vitest";
import { AyatrisyaModelClient } from "../ai/client";
import { resetDesktopRuntimeCache } from "../desktop/runtime";

describe("desktop-local model transport", () => {
  it("uses the loopback IPC adapter and forces non-streaming chat", async () => {
    const requestLocalModel = vi.fn(async (path: string) => {
      if (path === "/capabilities") {
        return {
          status: 200,
          contentType: "application/json",
          body: {
            models: [
              { id: "v1-fast", available: true, streaming: true, modalities: ["chat", "image", "stt", "tts"] },
              { id: "v2-best", available: false, reason: "Unavailable" },
            ],
          },
        };
      }
      if (path === "/generate/image") {
        return {
          status: 200,
          contentType: "application/json",
          body: { fileName: "sunrise.png", mimeType: "image/png", dataBase64: "iVBORw0KGgo=" },
        };
      }
      return {
        status: 200,
        contentType: "application/json",
        body: { text: "Local answer" },
      };
    });
    const bridge = {
      isDesktop: true as const,
      getRuntimeInfo: vi.fn().mockResolvedValue({
        bridgeName: "ayatrisya-desktop",
        apiVersion: 1,
        appVersion: "1.0.0",
        platform: "win32",
        capabilities: ["local-model-ipc", "local-project-files"],
        localModel: { endpointConfigured: true, models: [{ id: "v1-fast", available: true, modalities: ["chat", "image"] }] },
      }),
      getLocalModelEndpoint: vi.fn().mockResolvedValue("http://127.0.0.1:1234"),
      requestLocalModel,
      cancelLocalModelRequest: vi.fn().mockResolvedValue(undefined),
    };
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { ayatrisyaDesktop: bridge },
    });
    resetDesktopRuntimeCache();
    const client = new AyatrisyaModelClient();

    try {
      const caps = await client.getModelCapabilities();
      expect(caps[0]).toMatchObject({ available: true, streaming: false, modalities: ["chat", "image"] });
      const result = await client.generateResponse(
        [{ role: "user", content: "Say hello." }],
        { model: "v1-fast", mode: "Normal" },
      );
      expect(result).toBe("Local answer");
      const chatCall = requestLocalModel.mock.calls.find(([path]) => path === "/chat");
      expect(chatCall?.[1]).toBe("POST");
      expect(chatCall?.[2]).toMatchObject({ stream: false, model: "v1-fast" });
      const generated = await client.generateAsset("image", "A mountain at sunrise", {
        model: "v1-fast",
        format: "PNG",
        aspectRatio: "16:9",
        width: 1024,
        height: 576,
      });
      expect(generated.fileName).toBe("sunrise.png");
      expect(generated.blob.type).toBe("image/png");
      expect(requestLocalModel.mock.calls.every(([path]) => ["/capabilities", "/chat", "/generate/image"].includes(path))).toBe(true);
    } finally {
      resetDesktopRuntimeCache();
      if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
      else Reflect.deleteProperty(globalThis, "window");
    }
  });

  it("does not silently send desktop prompts to the hosted gateway when no local model is configured", async () => {
    const tokenProvider = vi.fn().mockResolvedValue("should-not-be-used");
    const fetch = vi.fn();
    const desktopProvider = vi.fn().mockResolvedValue({
      api: { getLocalModelEndpoint: vi.fn().mockResolvedValue("") },
      info: {
        bridgeName: "ayatrisya-desktop",
        apiVersion: 1,
        appVersion: "1.0.0",
        platform: "win32",
        capabilities: ["local-model-ipc"],
        localModel: { endpointConfigured: false, models: [] },
      },
    });
    vi.stubGlobal("fetch", fetch);
    const client = new AyatrisyaModelClient(tokenProvider, desktopProvider);
    await expect(client.generateResponse(
      [{ role: "user", content: "Keep this prompt local." }],
      { model: "v1-fast", mode: "Normal" },
    )).rejects.toThrow("Desktop prompts stay on this device; hosted inference is not used.");
    expect(tokenProvider).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("attempts exactly one controlled local recovery and succeeds without cloud fallback", async () => {
    let callCount = 0;
    const startSeedModelHost = vi.fn().mockResolvedValue({ state: "READY" });
    const requestLocalModel = vi.fn(async (path: string) => {
      if (path === "/capabilities") {
        return {
          status: 200,
          contentType: "application/json",
          body: { models: [{ id: "v1-fast", available: true, modalities: ["chat"] }] },
        };
      }
      if (path === "/health") {
        return { status: 200, contentType: "application/json", body: { status: "ok" } };
      }
      if (path === "/chat") {
        callCount++;
        if (callCount === 1) {
          throw new Error("Temporary crash");
        }
        return { status: 200, contentType: "application/json", body: { text: "Recovered local response" } };
      }
      return { status: 404, contentType: "application/json", body: { error: "not_found" } };
    });

    const bridge = {
      isDesktop: true as const,
      getRuntimeInfo: vi.fn().mockResolvedValue({
        bridgeName: "ayatrisya-desktop",
        apiVersion: 1,
        appVersion: "1.0.0",
        platform: "win32",
        capabilities: ["local-model-ipc", "local-seed-model-host"],
        localModel: { endpointConfigured: true, models: [{ id: "v1-fast", available: true, modalities: ["chat"] }] },
      }),
      getLocalModelEndpoint: vi.fn().mockResolvedValue("http://127.0.0.1:49382"),
      startSeedModelHost,
      requestLocalModel,
      cancelLocalModelRequest: vi.fn().mockResolvedValue(undefined),
    };
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", { configurable: true, value: { ayatrisyaDesktop: bridge } });
    resetDesktopRuntimeCache();

    try {
      const client = new AyatrisyaModelClient();
      const text = await client.generateResponse(
        [{ role: "user", content: "Test recovery" }],
        { model: "v1-fast", mode: "Normal" },
      );
      expect(text).toBe("Recovered local response");
      expect(startSeedModelHost).toHaveBeenCalledTimes(1);
      expect(callCount).toBe(2);
    } finally {
      resetDesktopRuntimeCache();
      if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
      else Reflect.deleteProperty(globalThis, "window");
    }
  });

  it("asks for permission and routes to cloud fallback when user approves, but stays local when declined", async () => {
    const fetchMock = vi.fn(async (_url: string) => {
      return new Response(JSON.stringify({ text: "Cloud planner response" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const bridge = {
      isDesktop: true as const,
      getRuntimeInfo: vi.fn().mockResolvedValue({
        bridgeName: "ayatrisya-desktop",
        apiVersion: 1,
        appVersion: "1.0.0",
        platform: "win32",
        capabilities: ["local-model-ipc", "local-seed-model-host"],
        localModel: { endpointConfigured: true, models: [{ id: "v1-fast", available: true, modalities: ["chat"] }] },
      }),
      getLocalModelEndpoint: vi.fn().mockResolvedValue("http://127.0.0.1:49382"),
      startSeedModelHost: vi.fn().mockRejectedValue(new Error("Host won't start")),
      requestLocalModel: vi.fn(async (path: string) => {
        if (path === "/capabilities") {
          return { status: 200, contentType: "application/json", body: { models: [{ id: "v1-fast", available: true, modalities: ["chat"] }] } };
        }
        throw new Error("Local model failed permanently");
      }),
      cancelLocalModelRequest: vi.fn().mockResolvedValue(undefined),
    };
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", { configurable: true, value: { ayatrisyaDesktop: bridge } });
    resetDesktopRuntimeCache();

    try {
      const client = new AyatrisyaModelClient(async () => "cloud-token");

      // 1. User declines fallback
      client.setFallbackConsentHandler(async () => false);
      await expect(client.generateResponse(
        [{ role: "user", content: "Prompt with declined fallback" }],
        { model: "v1-fast", mode: "Normal" },
      )).rejects.toThrow("Cloud fallback was declined.");
      expect(fetchMock).not.toHaveBeenCalled();

      // 2. User approves fallback
      client.setFallbackConsentHandler(async () => true);
      const cloudResult = await client.generateResponse(
        [{ role: "user", content: "Prompt with approved fallback" }],
        { model: "v1-fast", mode: "Normal" },
      );
      expect(cloudResult).toBe("Cloud planner response");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
      resetDesktopRuntimeCache();
      if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
      else Reflect.deleteProperty(globalThis, "window");
    }
  });

  it("correctly parses capabilities when model reason is null or omitted", async () => {
    const requestLocalModel = vi.fn(async (path: string) => {
      if (path === "/capabilities") {
        return {
          status: 200,
          contentType: "application/json",
          body: {
            models: [
              { id: "v1-fast", available: true, reason: null, modalities: ["chat"] },
              { id: "v2-best", available: false, reason: null, modalities: ["chat"] },
            ],
          },
        };
      }
      return { status: 404, contentType: "application/json", body: {} };
    });
    const bridge = {
      isDesktop: true as const,
      getRuntimeInfo: vi.fn().mockResolvedValue({
        bridgeName: "ayatrisya-desktop",
        apiVersion: 1,
        appVersion: "1.0.0",
        platform: "win32",
        capabilities: ["local-model-ipc"],
        localModel: { endpointConfigured: true, models: [] },
      }),
      getLocalModelEndpoint: vi.fn().mockResolvedValue("http://127.0.0.1:49382"),
      requestLocalModel,
      cancelLocalModelRequest: vi.fn().mockResolvedValue(undefined),
    };
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", { configurable: true, value: { ayatrisyaDesktop: bridge } });
    resetDesktopRuntimeCache();

    try {
      const client = new AyatrisyaModelClient();
      const caps = await client.getModelCapabilities();
      expect(caps).toHaveLength(2);
      expect(caps[0].id).toBe("v1-fast");
      expect(caps[0].available).toBe(true);
      expect(caps[0].reason).toBe("Ready");
      expect(caps[1].id).toBe("v2-best");
      expect(caps[1].available).toBe(false);
      expect(caps[1].reason).toBe("Model not ready");
    } finally {
      resetDesktopRuntimeCache();
      if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
      else Reflect.deleteProperty(globalThis, "window");
    }
  });
});

