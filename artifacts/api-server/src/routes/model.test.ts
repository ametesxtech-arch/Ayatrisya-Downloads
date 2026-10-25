import { once } from "node:events";
import { createServer, type Server } from "node:http";
import express from "express";
import pino from "pino";
import pinoHttp from "pino-http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("jose", () => ({
  createRemoteJWKSet: () => ({}),
  jwtVerify: async (token: string) => {
    if (!token.startsWith("firebase-")) throw new Error("invalid token");
    return { payload: { sub: token.slice("firebase-".length) } };
  },
}));

describe("authenticated Ayatrisya model gateway", () => {
  let server: Server | undefined;
  let origin = "";
  let realFetch: typeof fetch;

  beforeEach(() => {
    realFetch = globalThis.fetch.bind(globalThis);
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("FIREBASE_PROJECT_ID", "ayatrisya-model-test");
    vi.stubEnv("AYATRISYA_MODEL_ENDPOINT", "https://models.ayatrisya.example/v1/");
    vi.stubEnv("AYATRISYA_MODEL_API_KEY", "test-model-api-key");
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    if (server?.listening) {
      server.closeAllConnections();
      server.close();
      await once(server, "close");
    }
    server = undefined;
  });

  async function startApi() {
    vi.resetModules();
    const { default: modelRouter } = await import("./model");
    const app = express();
    app.use(pinoHttp({ logger: pino({ level: "silent" }) }));
    app.use(express.json({ limit: "1mb" }));
    app.use("/api", modelRouter);
    app.use("/api", (_req, res) => {
      res.status(404).set({
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
      }).json({ error: "The requested API endpoint was not found." });
    });
    server = createServer(app).listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test server address.");
    origin = `http://127.0.0.1:${address.port}`;
    return async (path: string, init: RequestInit = {}, token = "firebase-user-a") => {
      const headers = new Headers(init.headers);
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return realFetch(`${origin}${path}`, { ...init, headers });
    };
  }

  it("requires a Firebase identity before model access and rejects invalid tokens", async () => {
    const call = await startApi();
    const missing = await call("/api/model/health", {}, "");
    expect(missing.status).toBe(401);
    const invalid = await call("/api/model/health", {}, "forged-token");
    expect(invalid.status).toBe(401);
  });

  it("fails clearly and makes no upstream request when server configuration is missing", async () => {
    vi.stubEnv("AYATRISYA_MODEL_API_KEY", "");
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const call = await startApi();
    const response = await call("/api/model/health");
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: "The Ayatrisya hosted model service is not configured. Configure its server-side endpoint and API key.",
    });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects local HTTP endpoints with a desktop-only explanation before any upstream request", async () => {
    vi.stubEnv("AYATRISYA_MODEL_ENDPOINT", "http://192.168.1.20:1234/v1/");
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const call = await startApi();
    const response = await call("/api/model/health");
    expect(response.status).toBe(503);
    const body = await response.json() as { error: string };
    expect(body.error).toContain("require HTTPS");
    expect(body.error).toContain("Ayatrisya Desktop");
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects third-party inference endpoints without making an upstream request", async () => {
    vi.stubEnv("AYATRISYA_MODEL_ENDPOINT", "https://api.openai.com/v1/");
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const call = await startApi();
    const response = await call("/api/model/health");
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: "This provider is not permitted for Ayatrisya hosted inference.",
    });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("keeps the model API key server-side and validates upstream health output", async () => {
    const upstream = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe("https://models.ayatrisya.example/v1/health");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer test-model-api-key");
      expect(new Headers(init?.headers).get("authorization")).not.toContain("firebase-user-a");
      return Response.json({ status: "ok" });
    });
    vi.stubGlobal("fetch", upstream);
    const call = await startApi();
    const response = await call("/api/model/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it("permits loopback HTTP model endpoint in development and test environments", async () => {
    vi.stubEnv("AYATRISYA_MODEL_ENDPOINT", "http://127.0.0.1:8000/");
    vi.stubEnv("AYATRISYA_MODEL_API_KEY", "test-model-api-key");
    const upstream = vi.fn(async () => Response.json({ status: "ok" }));
    vi.stubGlobal("fetch", upstream);

    const call = await startApi();
    const response = await call("/api/model/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("validates model input before proxying and streams model output", async () => {
    const upstream = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      if (String(init?.body).includes('"messages"')) {
        return new Response('{"token":"A reply"}\n{"done":true}\n', {
          headers: { "Content-Type": "application/x-ndjson" },
        });
      }
      return Response.json({ models: [{ id: "v1-fast", available: true }] });
    });
    vi.stubGlobal("fetch", upstream);
    const call = await startApi();
    const invalid = await call("/api/model/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [], model: "unknown", mode: "Normal", stream: true }),
    });
    expect(invalid.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();

    const response = await call("/api/model/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Hello" }],
        model: "v1-fast",
        mode: "Normal",
        stream: true,
      }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toContain('"token":"A reply"');
  });

  it("applies generation limits per verified user without affecting another account", async () => {
    const upstream = vi.fn(async () => Response.json({
      fileName: "sample.png",
      mimeType: "image/png",
      dataBase64: "aGVsbG8=",
    }));
    vi.stubGlobal("fetch", upstream);
    const call = await startApi();
    const imageRequest = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "A simple test image", model: "v1-fast", format: "PNG", width: 512, height: 512 }),
    };

    for (let i = 0; i < 10; i += 1) {
      expect((await call("/api/model/generate/image", imageRequest, "firebase-user-a")).status).toBe(200);
    }
    const limited = await call("/api/model/generate/image", imageRequest, "firebase-user-a");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();

    const otherUser = await call("/api/model/generate/image", imageRequest, "firebase-user-b");
    expect(otherUser.status).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(11);
  });

  it("does not expose upstream error details or configured credentials", async () => {
    vi.stubGlobal("fetch", async () => new Response(
      JSON.stringify({ error: "private upstream traceback; test-model-api-key" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    ));
    const call = await startApi();
    const response = await call("/api/model/health");
    const body = await response.text();
    expect(response.status).toBe(503);
    expect(body).not.toContain("private upstream traceback");
    expect(body).not.toContain("test-model-api-key");
  });

  it("seamlessly engages Gemini fallback when primary upstream model is unavailable", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const urlStr = String(input);
      if (urlStr.includes("models.ayatrisya.example")) {
        return new Response("Service Unavailable", { status: 503 });
      }
      if (urlStr.includes("generativelanguage.googleapis.com")) {
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "Fallback AI response" }] } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error("Unexpected fetch target: " + urlStr);
    });
    vi.stubGlobal("fetch", fetchMock);

    const call = await startApi();
    const response = await call("/api/model/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Test fallback" }],
        model: "v1-fast",
        mode: "Normal",
        stream: false,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toMatchObject({ text: "Fallback AI response" });
    expect(fetchMock).toHaveBeenCalled();
  });

  it("returns 503 when primary model fails and fallback also fails", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const urlStr = String(input);
      if (urlStr.includes("models.ayatrisya.example")) {
        return new Response("Primary unavailable", { status: 503 });
      }
      if (urlStr.includes("generativelanguage.googleapis.com")) {
        return new Response("Gemini unavailable", { status: 500 });
      }
      throw new Error("Unexpected fetch target: " + urlStr);
    });
    vi.stubGlobal("fetch", fetchMock);

    const call = await startApi();
    const response = await call("/api/model/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Test failure" }],
        model: "v1-fast",
        mode: "Normal",
        stream: false,
      }),
    });

    expect(response.status).toBe(503);
    const body = await response.text();
    expect(body).not.toContain("test-gemini-key");
    expect(body).not.toContain("test-model-api-key");
  });

  it("returns 503 when both primary and fallback providers are unconfigured", async () => {
    vi.stubEnv("AYATRISYA_MODEL_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const call = await startApi();
    const response = await call("/api/model/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Test unconfigured" }],
        model: "v1-fast",
        mode: "Normal",
        stream: false,
      }),
    });

    expect(response.status).toBe(503);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("returns fallback capabilities when primary model is unconfigured and Gemini fallback is present", async () => {
    vi.stubEnv("AYATRISYA_MODEL_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
    const call = await startApi();
    const response = await call("/api/model/capabilities");

    expect(response.status).toBe(200);
    const data = (await response.json()) as { models: Array<{ id: string; available: boolean; modalities: string[] }> };
    expect(data.models).toHaveLength(2);
    expect(data.models[0]).toMatchObject({ id: "v1-fast", available: true, modalities: ["chat"] });
    expect(data.models[1]).toMatchObject({ id: "v2-best", available: true, modalities: ["chat"] });
  });

  it("fails honestly without generating fake placeholder gradients when image model is unconfigured", async () => {
    vi.stubEnv("AYATRISYA_MODEL_API_KEY", "");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "");
    const call = await startApi();
    const response = await call("/api/model/generate/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "A glowing nebula over cyber mountains", model: "v1-fast", format: "PNG", width: 256, height: 256 }),
    });

    expect(response.status).toBe(503);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("No image generation model is configured");
    expect(data.error).toContain("CLOUDFLARE_ACCOUNT_ID");
  });

  it("handles real cloud image generation via Cloudflare Workers AI", async () => {
    vi.stubEnv("AYATRISYA_MODEL_API_KEY", "");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "cf-test-acc");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "cf-test-token");
    const validPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkWPjfDwAEeQHzHk9t5gAAAABJRU5ErkJggg==";
    
    let calledUrl = "";
    let calledAuth = "";
    vi.stubGlobal("fetch", async (input: any, init?: any) => {
      calledUrl = String(input);
      calledAuth = init?.headers?.Authorization || "";
      return new Response(
        JSON.stringify({
          success: true,
          result: {
            image: validPngBase64,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const call = await startApi();
    const response = await call("/api/model/generate/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "A ginger cat", model: "v1-fast", format: "PNG", width: 256, height: 256 }),
    });

    expect(response.status).toBe(200);
    const data = (await response.json()) as { fileName: string; mimeType: string; dataBase64: string };
    expect(data.mimeType).toBe("image/png");
    expect(data.dataBase64).toBe(validPngBase64);
    expect(calledUrl).toContain("api.cloudflare.com/client/v4/accounts/cf-test-acc/ai/run/@cf/black-forest-labs/flux-1-schnell");
    expect(calledAuth).toBe("Bearer cf-test-token");
  });

  it("reports image capability in /capabilities when Cloudflare Workers AI credentials are configured", async () => {
    vi.stubEnv("AYATRISYA_MODEL_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "cf-test-acc");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "cf-test-token");
    const call = await startApi();
    const response = await call("/api/model/capabilities");

    expect(response.status).toBe(200);
    const data = (await response.json()) as { models: Array<{ id: string; available: boolean; modalities: string[] }> };
    expect(data.models[0].modalities).toContain("chat");
    expect(data.models[0].modalities).toContain("image");
    expect(data.models[1].modalities).toContain("chat");
    expect(data.models[1].modalities).toContain("image");
  });

  it("fails honestly with 429 and does not silently fall back to Gemini when Cloudflare quota is exhausted", async () => {
    vi.stubEnv("AYATRISYA_MODEL_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "cf-test-acc");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "cf-test-token");

    vi.stubGlobal("fetch", async () => {
      return new Response(
        JSON.stringify({
          success: false,
          errors: [{ message: "Daily quota exceeded" }],
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    });

    const call = await startApi();
    const response = await call("/api/model/generate/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "A glowing nebula", model: "v1-fast", format: "PNG", width: 256, height: 256 }),
    });

    expect(response.status).toBe(429);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("10,000 free Neurons/day");
    expect(data.error).toContain("Daily quota exceeded");
  });

  function createMinimalValidGlb(nodeName = "Cat"): Buffer {
    const json = JSON.stringify({
      asset: { version: "2.0", generator: "Ayatrisya 3D Test" },
      scenes: [{ nodes: [0] }],
      nodes: [{ name: nodeName }],
    });
    let jsonBuffer = Buffer.from(json, "utf8");
    const pad = (4 - (jsonBuffer.length % 4)) % 4;
    if (pad > 0) {
      jsonBuffer = Buffer.concat([jsonBuffer, Buffer.alloc(pad, 0x20)]);
    }
    const totalLength = 12 + 8 + jsonBuffer.length;
    const header = Buffer.alloc(12);
    header.write("glTF", 0, "ascii");
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(totalLength, 8);

    const chunkHeader = Buffer.alloc(8);
    chunkHeader.writeUInt32LE(jsonBuffer.length, 0);
    chunkHeader.write("JSON", 4, "ascii");

    return Buffer.concat([header, chunkHeader, jsonBuffer]);
  }

  it("returns 503 explaining configuration when 3D model endpoint is unconfigured", async () => {
    vi.stubEnv("AYATRISYA_MODEL_API_KEY", "");
    const call = await startApi();
    const response = await call("/api/model/generate/3d", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "A small stylized cat", model: "v1-fast", format: "GLB" }),
    });

    expect(response.status).toBe(503);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("No 3D generation model is configured");
  });

  it("proxies and validates genuine GLB 3D output from configured provider", async () => {
    const validGlb = createMinimalValidGlb("StylizedCat");
    vi.stubGlobal("fetch", vi.fn(async (input: any) => {
      const url = String(input);
      if (url.includes("/generate/3d")) {
        return new Response(JSON.stringify({
          fileName: "cat.glb",
          mimeType: "model/gltf-binary",
          dataBase64: validGlb.toString("base64"),
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return realFetch(input as any);
    }));

    const call = await startApi();
    const response = await call("/api/model/generate/3d", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "a small stylized cat", model: "v1-fast", format: "GLB" }),
    });

    expect(response.status).toBe(200);
    const data = (await response.json()) as { fileName: string; mimeType: string; dataBase64: string };
    expect(data.mimeType).toBe("model/gltf-binary");
    expect(data.fileName).toBe("cat.glb");
    const buffer = Buffer.from(data.dataBase64, "base64");
    expect(buffer.subarray(0, 4).toString("ascii")).toBe("glTF");
    expect(buffer.readUInt32LE(4)).toBe(2);
  });

  it("supports URL-based 3D assets by resolving and validating the GLB file", async () => {
    const validGlb = createMinimalValidGlb("PersianCat");
    vi.stubGlobal("fetch", vi.fn(async (input: any) => {
      const url = String(input);
      if (url.includes("/generate/3d")) {
        return new Response(JSON.stringify({
          fileName: "persian-cat.glb",
          fileUrl: "https://models.ayatrisya.example/files/persian-cat.glb",
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url === "https://models.ayatrisya.example/files/persian-cat.glb") {
        return new Response(validGlb, {
          status: 200,
          headers: { "Content-Type": "model/gltf-binary" },
        });
      }
      return realFetch(input as any);
    }));

    const call = await startApi();
    const response = await call("/api/model/generate/3d", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "a fluffy persian cat", model: "v1-fast", format: "GLB" }),
    });

    expect(response.status).toBe(200);
    const data = (await response.json()) as { fileName: string; mimeType: string; dataBase64: string };
    expect(data.mimeType).toBe("model/gltf-binary");
    const buffer = Buffer.from(data.dataBase64, "base64");
    expect(buffer.subarray(0, 4).toString("ascii")).toBe("glTF");
  });

  it("rejects HTML error pages returned by upstream provider with 502", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: any) => {
      const url = String(input);
      if (url.includes("/generate/3d")) {
        return new Response(JSON.stringify({
          fileName: "cat.glb",
          dataBase64: Buffer.from("<!DOCTYPE html><html><body>500 Internal Error</body></html>").toString("base64"),
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return realFetch(input as any);
    }));

    const call = await startApi();
    const response = await call("/api/model/generate/3d", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "cat", model: "v1-fast", format: "GLB" }),
    });

    expect(response.status).toBe(502);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("HTML");
  });

  it("rejects truncated or corrupted GLB files with 502", async () => {
    const validGlb = createMinimalValidGlb("Cat");
    const truncatedGlb = validGlb.subarray(0, 24); // Truncate the file
    vi.stubGlobal("fetch", vi.fn(async (input: any) => {
      const url = String(input);
      if (url.includes("/generate/3d")) {
        return new Response(JSON.stringify({
          fileName: "cat.glb",
          dataBase64: truncatedGlb.toString("base64"),
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return realFetch(input as any);
    }));

    const call = await startApi();
    const response = await call("/api/model/generate/3d", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "cat", model: "v1-fast", format: "GLB" }),
    });

    expect(response.status).toBe(502);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("truncated");
  });

  it("rejects PNG images disguised as GLB files with 502", async () => {
    const fakeGlbPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    vi.stubGlobal("fetch", vi.fn(async (input: any) => {
      const url = String(input);
      if (url.includes("/generate/3d")) {
        return new Response(JSON.stringify({
          fileName: "cat.glb",
          dataBase64: fakeGlbPng.toString("base64"),
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return realFetch(input as any);
    }));

    const call = await startApi();
    const response = await call("/api/model/generate/3d", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "cat", model: "v1-fast", format: "GLB" }),
    });

    expect(response.status).toBe(502);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("PNG");
  });

  function createMinimalValidWav(durationSeconds = 1, sampleRate = 8000, numChannels = 1): Buffer {
    const bytesPerSample = 2; // 16-bit PCM
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const numSamples = Math.floor(sampleRate * durationSeconds);
    const dataSize = numSamples * blockAlign;
    const buffer = Buffer.alloc(44 + dataSize);

    buffer.write("RIFF", 0, "ascii");
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write("WAVE", 8, "ascii");

    buffer.write("fmt ", 12, "ascii");
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); // PCM
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(16, 34);

    buffer.write("data", 36, "ascii");
    buffer.writeUInt32LE(dataSize, 40);

    return buffer;
  }

  it("returns 503 explaining configuration when music model endpoint is unconfigured", async () => {
    vi.stubEnv("AYATRISYA_MODEL_API_KEY", "");
    const call = await startApi();
    const response = await call("/api/model/generate/music", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "drums", model: "v1-fast", format: "WAV", durationSeconds: 20 }),
    });

    expect(response.status).toBe(503);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("No music generation model is configured");
  });

  it("proxies and validates genuine WAV audio output from configured provider", async () => {
    const validWav = createMinimalValidWav(20);
    vi.stubGlobal("fetch", vi.fn(async (input: any) => {
      const url = String(input);
      if (url.includes("/generate/music")) {
        return new Response(JSON.stringify({
          fileName: "drums.wav",
          mimeType: "audio/wav",
          dataBase64: validWav.toString("base64"),
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return realFetch(input as any);
    }));

    const call = await startApi();
    const response = await call("/api/model/generate/music", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "drums", model: "v1-fast", format: "WAV", durationSeconds: 20 }),
    });

    expect(response.status).toBe(200);
    const data = (await response.json()) as { fileName: string; mimeType: string; dataBase64: string };
    expect(data.mimeType).toBe("audio/wav");
    expect(data.fileName).toBe("drums.wav");
    const buffer = Buffer.from(data.dataBase64, "base64");
    expect(buffer.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(buffer.subarray(8, 12).toString("ascii")).toBe("WAVE");
  });

  it("supports URL-based music assets by resolving and validating the WAV file", async () => {
    const validWav = createMinimalValidWav(10);
    vi.stubGlobal("fetch", vi.fn(async (input: any) => {
      const url = String(input);
      if (url.includes("/generate/music")) {
        return new Response(JSON.stringify({
          fileName: "acoustic-guitar.wav",
          fileUrl: "https://models.ayatrisya.example/files/acoustic-guitar.wav",
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url === "https://models.ayatrisya.example/files/acoustic-guitar.wav") {
        return new Response(validWav, {
          status: 200,
          headers: { "Content-Type": "audio/wav" },
        });
      }
      return realFetch(input as any);
    }));

    const call = await startApi();
    const response = await call("/api/model/generate/music", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "acoustic guitar fingerpicking", model: "v1-fast", format: "WAV", durationSeconds: 10 }),
    });

    expect(response.status).toBe(200);
    const data = (await response.json()) as { fileName: string; mimeType: string; dataBase64: string };
    expect(data.mimeType).toBe("audio/wav");
    const buffer = Buffer.from(data.dataBase64, "base64");
    expect(buffer.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(buffer.subarray(8, 12).toString("ascii")).toBe("WAVE");
  });

  it("rejects HTML error pages returned for music generation with 502", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: any) => {
      const url = String(input);
      if (url.includes("/generate/music")) {
        return new Response(JSON.stringify({
          fileName: "drums.wav",
          dataBase64: Buffer.from("<!DOCTYPE html><html><body>500 Internal Error</body></html>").toString("base64"),
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return realFetch(input as any);
    }));

    const call = await startApi();
    const response = await call("/api/model/generate/music", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "drums", model: "v1-fast", format: "WAV", durationSeconds: 20 }),
    });

    expect(response.status).toBe(502);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("HTML");
  });

  it("rejects zero duration or truncated WAV files with 502", async () => {
    const emptyWav = Buffer.alloc(44);
    emptyWav.write("RIFF", 0, "ascii");
    emptyWav.writeUInt32LE(36, 4);
    emptyWav.write("WAVE", 8, "ascii");
    emptyWav.write("fmt ", 12, "ascii");
    emptyWav.writeUInt32LE(16, 16);
    emptyWav.writeUInt16LE(1, 20);
    emptyWav.writeUInt16LE(1, 22);
    emptyWav.writeUInt32LE(8000, 24);
    emptyWav.writeUInt32LE(16000, 28);
    emptyWav.writeUInt16LE(2, 32);
    emptyWav.writeUInt16LE(16, 34);
    emptyWav.write("data", 36, "ascii");
    emptyWav.writeUInt32LE(0, 40); // 0 data length

    vi.stubGlobal("fetch", vi.fn(async (input: any) => {
      const url = String(input);
      if (url.includes("/generate/music")) {
        return new Response(JSON.stringify({
          fileName: "drums.wav",
          dataBase64: emptyWav.toString("base64"),
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return realFetch(input as any);
    }));

    const call = await startApi();
    const response = await call("/api/model/generate/music", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "drums", model: "v1-fast", format: "WAV", durationSeconds: 20 }),
    });

    expect(response.status).toBe(502);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("zero audio samples");
  });

  it("rejects PNG images disguised as audio files with 502", async () => {
    const fakeAudioPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
    vi.stubGlobal("fetch", vi.fn(async (input: any) => {
      const url = String(input);
      if (url.includes("/generate/music")) {
        return new Response(JSON.stringify({
          fileName: "drums.wav",
          dataBase64: fakeAudioPng.toString("base64"),
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return realFetch(input as any);
    }));

    const call = await startApi();
    const response = await call("/api/model/generate/music", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "drums", model: "v1-fast", format: "WAV", durationSeconds: 20 }),
    });

    expect(response.status).toBe(502);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("PNG");
  });
});
