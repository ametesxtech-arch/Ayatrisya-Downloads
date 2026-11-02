import { describe, expect, it, vi } from "vitest";
import { normalizeHfSpaceBaseUrl, isHuggingFaceSpaceUrl, callHfGradioApi } from "../lib/hf-space-client";

describe("Hugging Face Space Client & URL Normalization", () => {
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
});
