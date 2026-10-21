import { describe, expect, it, vi } from "vitest";
import { AyatrisyaModelClient } from "../ai/client";

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
      getLocalModelEndpoint: vi.fn().mockResolvedValue("http://127.0.0.1:1234"),
      requestLocalModel,
      cancelLocalModelRequest: vi.fn().mockResolvedValue(undefined),
    };
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { ayatrisyaDesktop: bridge },
    });
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
      if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
      else Reflect.deleteProperty(globalThis, "window");
    }
  });
});
