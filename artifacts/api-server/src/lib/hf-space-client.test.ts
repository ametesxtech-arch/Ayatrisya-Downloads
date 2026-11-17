import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  normalizeHfSpaceBaseUrl,
  isHuggingFaceSpaceUrl,
  callHfGradioApi,
  callHfDirectRestApi,
  discoverHfCapabilities,
  getCachedCapabilities,
  setCachedCapabilities,
  clearCapabilitiesCache,
} from "../lib/hf-space-client";

describe("Hugging Face Space Client & URL Normalization", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearCapabilitiesCache();
  });
  it("normalizes standard Space URLs to direct .hf.space endpoints", () => {
    expect(
      normalizeHfSpaceBaseUrl("https://huggingface.co/spaces/grpAX/ayatrisya-chat-model-server")
    ).toBe("https://grpax-ayatrisya-chat-model-server.hf.space");

    expect(
      normalizeHfSpaceBaseUrl("https://grpax-ayatrisya-chat-model-server.hf.space/")
    ).toBe("https://grpax-ayatrisya-chat-model-server.hf.space");
  });

  it("accurately detects valid Hugging Face space URLs and rejects arbitrary domains", () => {
    expect(isHuggingFaceSpaceUrl("https://huggingface.co/spaces/grpAX/ayatrisya-chat-model-server")).toBe(true);
    expect(isHuggingFaceSpaceUrl("https://grpax-ayatrisya-chat-model-server.hf.space")).toBe(true);
    expect(isHuggingFaceSpaceUrl("http://grpax-ayatrisya-chat-model-server.hf.space")).toBe(false); // rejects HTTP
    expect(isHuggingFaceSpaceUrl("https://evil-site.com")).toBe(false);
  });

  it("handles standard Gradio SSE event stream protocol correctly", async () => {
    const sseBody = [
      "event: status",
      'data: {"status": "QUEUED"}',
      "",
      "event: status",
      'data: {"status": "RUNNING"}',
      "",
      "event: complete",
      'data: ["{\\"text\\": \\"Hello from Ayatrisya Qwen ZeroGPU!\\"}"]',
      "",
    ].join("\n");

    vi.stubGlobal("fetch", async (url: string) => {
      if (url.includes("/gradio_api/call/predict") && !url.includes("event_123")) {
        return new Response(JSON.stringify({ event_id: "event_123" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/gradio_api/call/predict/event_123")) {
        return new Response(sseBody, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      }
      return new Response("Not found", { status: 404 });
    });

    const result = (await callHfGradioApi(
      {
        spaceUrl: "https://huggingface.co/spaces/grpAX/ayatrisya-chat-model-server",
        readToken: "hf_mock_token",
      },
      "predict",
      ['{"messages": [{"role": "user", "content": "hi"}]}']
    )) as { text?: string };

    expect(result).toEqual({ text: "Hello from Ayatrisya Qwen ZeroGPU!" });
  });

  it("rejects when HF Space returns an error event", async () => {
    const sseBody = [
      "event: error",
      'data: "CUDA out of memory or quota exceeded"',
      "",
    ].join("\n");

    vi.stubGlobal("fetch", async (url: string) => {
      if (url.includes("/gradio_api/call/predict") && !url.includes("event_456")) {
        return new Response(JSON.stringify({ event_id: "event_456" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/gradio_api/call/predict/event_456")) {
        return new Response(sseBody, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      }
      return new Response("Not found", { status: 404 });
    });

    await expect(
      callHfGradioApi(
        {
          spaceUrl: "https://huggingface.co/spaces/grpAX/ayatrisya-chat-model-server",
        },
        "predict",
        []
      )
    ).rejects.toThrow(/HF Space error event/);
  });

  describe("Direct REST API client", () => {
    it("handles HTTP 200 response correctly", async () => {
      vi.stubGlobal("fetch", async (url: string) => {
        if (url.endsWith("/capabilities")) {
          return new Response(JSON.stringify({ models: [{ id: "v1-fast", available: true }] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("Not found", { status: 404 });
      });

      const res = await callHfDirectRestApi(
        { spaceUrl: "https://grpax-ayatrisya-chat-model-server.hf.space" },
        "/capabilities",
        "GET"
      );

      expect(res.ok).toBe(true);
      expect(res.status).toBe(200);
      expect(res.data).toEqual({ models: [{ id: "v1-fast", available: true }] });
    });

    it("correctly identifies HTTP 404 Not Found without throwing", async () => {
      vi.stubGlobal("fetch", async () => {
        return new Response("404 Not Found", { status: 404 });
      });

      const res = await callHfDirectRestApi(
        { spaceUrl: "https://grpax-ayatrisya-chat-model-server.hf.space" },
        "/capabilities",
        "GET"
      );

      expect(res.ok).toBe(false);
      expect(res.isNotFound).toBe(true);
      expect(res.status).toBe(404);
    });

    it("correctly identifies HTTP 401/403 Unauthorized", async () => {
      vi.stubGlobal("fetch", async () => {
        return new Response("Unauthorized", { status: 401 });
      });

      const res = await callHfDirectRestApi(
        { spaceUrl: "https://grpax-ayatrisya-chat-model-server.hf.space" },
        "/chat",
        "POST",
        { messages: [] }
      );

      expect(res.ok).toBe(false);
      expect(res.isUnauthorized).toBe(true);
      expect(res.status).toBe(401);
    });

    it("correctly identifies HTTP 429 Rate Limit", async () => {
      vi.stubGlobal("fetch", async () => {
        return new Response("Too Many Requests", { status: 429 });
      });

      const res = await callHfDirectRestApi(
        { spaceUrl: "https://grpax-ayatrisya-chat-model-server.hf.space" },
        "/chat",
        "POST",
        { messages: [] }
      );

      expect(res.ok).toBe(false);
      expect(res.isRateLimited).toBe(true);
      expect(res.status).toBe(429);
    });
  });

  describe("Capabilities Discovery & Caching", () => {
    it("discovers capabilities via direct REST when available", async () => {
      const mockCaps = {
        models: [
          { id: "v1-fast", available: true, modalities: ["chat", "coding"] },
          { id: "v2-best", available: true, modalities: ["chat", "coding"] },
        ],
      };

      vi.stubGlobal("fetch", async (url: string) => {
        if (url.endsWith("/capabilities")) {
          return new Response(JSON.stringify(mockCaps), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("Not found", { status: 404 });
      });

      const caps = await discoverHfCapabilities({
        spaceUrl: "https://grpax-ayatrisya-chat-model-server.hf.space",
      });

      expect(caps.models.length).toBe(2);
      expect(caps.models[0].id).toBe("v1-fast");

      // Verify cached
      const cached = getCachedCapabilities("https://grpax-ayatrisya-chat-model-server.hf.space");
      expect(cached).toEqual(mockCaps);
    });

    it("falls back to health check when direct REST and Gradio capabilities return 404", async () => {
      vi.stubGlobal("fetch", async (url: string) => {
        if (url.includes("/health")) {
          return new Response(
            JSON.stringify({
              status: "ok",
              model: "Qwen/Qwen2.5-Coder-32B-Instruct",
              device: "cuda",
              modalities: ["chat", "coding", "planning"],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response("Not found", { status: 404 });
      });

      const caps = await discoverHfCapabilities({
        spaceUrl: "https://grpax-ayatrisya-chat-model-server.hf.space",
      });

      expect(caps.models.length).toBe(2);
      expect(caps.models[0].available).toBe(true);
      expect(caps.models[0].reason).toContain("Qwen/Qwen2.5-Coder-32B-Instruct");
      expect(caps.models[0].modalities).toEqual(["chat", "coding", "planning"]);
    });

    it("expires cached capabilities after TTL", () => {
      const mockCaps: any = { models: [{ id: "v1-fast", available: true }] };
      setCachedCapabilities("https://test.hf.space", mockCaps, 10); // 10ms TTL

      expect(getCachedCapabilities("https://test.hf.space")).toEqual(mockCaps);

      // Advance time beyond TTL
      vi.spyOn(Date, "now").mockReturnValue(Date.now() + 20);
      expect(getCachedCapabilities("https://test.hf.space")).toBeNull();
    });
  });
});
