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
    expect(await response.json()).toMatchObject({ error: "The Ayatrisya model endpoint is not configured." });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects loopback and known third-party inference endpoints", async () => {
    vi.stubEnv("AYATRISYA_MODEL_ENDPOINT", "https://api.openai.com/v1/");
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const call = await startApi();
    const response = await call("/api/model/health");
    expect(response.status).toBe(503);
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
});
