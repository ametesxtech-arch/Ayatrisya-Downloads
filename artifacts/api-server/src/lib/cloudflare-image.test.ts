import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Response } from "express";
import {
  getCloudflareConfig,
  isCloudflareConfigured,
  validateImageBuffer,
  generateCloudflareImage,
  CLOUDFLARE_PRIMARY_IMAGE_MODEL,
} from "./cloudflare-image";

describe("Cloudflare Workers AI Image Generation Provider", () => {
  const valid1x1PngBytes = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ]);

  const validJpegBytes = Buffer.alloc(100);
  validJpegBytes[0] = 0xff;
  validJpegBytes[1] = 0xd8;
  validJpegBytes[2] = 0xff;

  function mockResponse(): { res: Response; getStatus: () => number; getBody: () => any } {
    let statusCode = 200;
    let body: any = null;
    const res: any = {
      headersSent: false,
      status: vi.fn((s: number) => {
        statusCode = s;
        return res;
      }),
      set: vi.fn(() => res),
      json: vi.fn((data: any) => {
        body = data;
        res.headersSent = true;
        return res;
      }),
    };
    return {
      res: res as Response,
      getStatus: () => statusCode,
      getBody: () => body,
    };
  }

  beforeEach(() => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "test-account-id-12345");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "test-token-abcdef");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("checks credentials and detects when configuration is present or absent", () => {
    expect(isCloudflareConfigured()).toBe(true);
    expect(getCloudflareConfig()).toEqual({
      accountId: "test-account-id-12345",
      apiToken: "test-token-abcdef",
    });

    vi.stubEnv("CLOUDFLARE_API_TOKEN", "");
    expect(isCloudflareConfigured()).toBe(false);
    expect(getCloudflareConfig()).toBeNull();
  });

  it("validates genuine PNG, JPEG, and WebP buffers and rejects HTML/corrupted buffers", () => {
    expect(validateImageBuffer(valid1x1PngBytes)).toMatchObject({ valid: true, mimeType: "image/png" });
    expect(validateImageBuffer(validJpegBytes)).toMatchObject({ valid: true, mimeType: "image/jpeg" });

    // HTML error page
    const htmlBuf = Buffer.from("<!DOCTYPE html><html><body>Error 500</body></html>");
    expect(validateImageBuffer(htmlBuf)).toMatchObject({ valid: false });

    // Corrupt ASCII
    const textBuf = Buffer.from("Just a random text file pretending to be an image");
    expect(validateImageBuffer(textBuf)).toMatchObject({ valid: false });

    // Empty/too short
    expect(validateImageBuffer(Buffer.alloc(10))).toMatchObject({ valid: false });
  });

  it("fails with 503 if credentials are not configured", async () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "");
    const { res, getStatus, getBody } = mockResponse();
    await generateCloudflareImage(res, { prompt: "a cute robot" });

    expect(getStatus()).toBe(503);
    expect(getBody().error).toContain("CLOUDFLARE_ACCOUNT_ID");
  });

  it("fails with 400 if prompt is empty", async () => {
    const { res, getStatus, getBody } = mockResponse();
    await generateCloudflareImage(res, { prompt: "   " });

    expect(getStatus()).toBe(400);
    expect(getBody().error).toContain("prompt is required");
  });

  it("successfully calls Cloudflare flux-1-schnell and returns 200 with validated image data", async () => {
    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input);
      expect(url).toContain(CLOUDFLARE_PRIMARY_IMAGE_MODEL);
      expect(init?.headers?.Authorization).toBe("Bearer test-token-abcdef");
      const payload = JSON.parse(init?.body || "{}");
      expect(payload.prompt).toBe("A cinematic landscape of mountains at sunset");
      expect(payload.steps).toBe(4);

      return new Response(
        JSON.stringify({
          success: true,
          result: {
            image: valid1x1PngBytes.toString("base64"),
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const { res, getStatus, getBody } = mockResponse();
    await generateCloudflareImage(res, { prompt: "A cinematic landscape of mountains at sunset" });

    expect(getStatus()).toBe(200);
    const body = getBody();
    expect(body.mimeType).toBe("image/png");
    expect(body.dataBase64).toBe(valid1x1PngBytes.toString("base64"));
    expect(body.fileName).toBe("ayatrisya-generated.png");
  });

  it("handles binary image stream responses from Cloudflare", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(validJpegBytes, {
          status: 200,
          headers: { "Content-Type": "image/jpeg" },
        });
      })
    );

    const { res, getStatus, getBody } = mockResponse();
    await generateCloudflareImage(res, { prompt: "A glowing nebula" });

    expect(getStatus()).toBe(200);
    const body = getBody();
    expect(body.mimeType).toBe("image/jpeg");
    expect(body.fileName).toBe("ayatrisya-generated.jpg");
  });

  it("handles 401/403 authentication failures gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({ success: false, errors: [{ code: 10000, message: "Authentication error" }] }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      })
    );

    const { res, getStatus, getBody } = mockResponse();
    await generateCloudflareImage(res, { prompt: "A castle" });

    expect(getStatus()).toBe(503);
    expect(getBody().error).toContain("authentication failed");
  });

  it("handles 429 quota exhaustion with honest free-tier limit explanation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({ success: false, errors: [{ code: 10015, message: "Rate limit exceeded" }] }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      })
    );

    const { res, getStatus, getBody } = mockResponse();
    await generateCloudflareImage(res, { prompt: "A starship" });

    expect(getStatus()).toBe(429);
    expect(getBody().error).toContain("10,000 free Neurons/day limit");
    expect(getBody().error).toContain("00:00 UTC");
  });

  it("handles 400 prompt refusal by safety filter", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({ success: false, errors: [{ code: 10004, message: "Prompt violated safety guidelines" }] }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      })
    );

    const { res, getStatus, getBody } = mockResponse();
    await generateCloudflareImage(res, { prompt: "Blocked prompt" });

    expect(getStatus()).toBe(400);
    expect(getBody().error).toContain("safety guidelines");
  });

  it("attempts fallback model if primary model returns 503", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: any) => {
        callCount++;
        const url = String(input);
        if (url.includes(CLOUDFLARE_PRIMARY_IMAGE_MODEL)) {
          return new Response("Service Unavailable", { status: 503 });
        }
        // Fallback model succeeds
        return new Response(
          JSON.stringify({
            success: true,
            result: { image: valid1x1PngBytes.toString("base64") },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      })
    );

    const { res, getStatus } = mockResponse();
    await generateCloudflareImage(res, { prompt: "A friendly dog" });

    expect(callCount).toBeGreaterThanOrEqual(2);
    expect(getStatus()).toBe(200);
  });
});
