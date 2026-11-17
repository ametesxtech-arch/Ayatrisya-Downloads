import { once } from "node:events";
import { createServer, type Server } from "node:http";
import express from "express";
import pino from "pino";
import pinoHttp from "pino-http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import authCanvasRouter, { clearAllCanvasTickets } from "./auth-canvas";

vi.mock("jose", () => ({
  createRemoteJWKSet: () => ({}),
  jwtVerify: async (token: string) => {
    if (!token.startsWith("firebase-")) throw new Error("invalid token");
    return { payload: { sub: token.slice("firebase-".length), email: `${token.slice("firebase-".length)}@example.com` } };
  },
}));

describe("Canvas Cross-Domain Authentication & Single-Use Ticket API", () => {
  let server: Server | undefined;
  let origin = "";

  beforeEach(() => {
    clearAllCanvasTickets();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("FIREBASE_PROJECT_ID", "ayatrisya-test");
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    clearAllCanvasTickets();
    if (server?.listening) {
      server.closeAllConnections();
      server.close();
      await once(server, "close");
    }
    server = undefined;
  });

  async function startApi() {
    const app = express();
    app.use(pinoHttp({ logger: pino({ level: "silent" }) }));
    app.use(express.json());
    app.use("/api", authCanvasRouter);
    server = createServer(app).listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test server address.");
    origin = `http://127.0.0.1:${address.port}`;
    return async (path: string, init: RequestInit = {}, token?: string) => {
      const headers = new Headers(init.headers);
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return fetch(`${origin}${path}`, { ...init, headers });
    };
  }

  it("rejects unauthenticated requests to /auth/canvas/ticket with 401", async () => {
    const call = await startApi();
    const res = await call("/api/auth/canvas/ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetOrigin: "https://canvas.ayatrisya.web.app" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects invalid target origin for ticket generation with 400", async () => {
    const call = await startApi();
    const res = await call("/api/auth/canvas/ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetOrigin: "https://attacker-domain.com" }),
    }, "firebase-user-123");
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toContain("Invalid target Canvas origin");
  });

  it("generates a single-use authorization ticket for authenticated user and exchanges it", async () => {
    const call = await startApi();

    // 1. Generate ticket
    const ticketRes = await call("/api/auth/canvas/ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetOrigin: "https://canvas.ayatrisya.web.app",
        email: "student@example.com",
        displayName: "Ayatrisya Student",
      }),
    }, "firebase-user-456");

    expect(ticketRes.status).toBe(200);
    const ticketData = await ticketRes.json() as { code: string; expiresInSeconds: number };
    expect(ticketData.code).toMatch(/^cac_/);
    expect(ticketData.expiresInSeconds).toBe(60);

    // 2. Exchange code from Canvas
    const exchangeRes = await call("/api/auth/canvas/exchange", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://canvas.ayatrisya.web.app",
      },
      body: JSON.stringify({ code: ticketData.code }),
    });

    expect(exchangeRes.status).toBe(200);
    const exchangeData = await exchangeRes.json() as { user: { uid: string; email: string; displayName: string }; idToken: string };
    expect(exchangeData.user.uid).toBe("user-456");
    expect(exchangeData.user.email).toBe("student@example.com");
    expect(exchangeData.idToken).toBe("firebase-user-456");

    // 3. Attempting replay / reuse fails immediately (strictly single-use)
    const replayRes = await call("/api/auth/canvas/exchange", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://canvas.ayatrisya.web.app",
      },
      body: JSON.stringify({ code: ticketData.code }),
    });

    expect(replayRes.status).toBe(401);
    const replayData = await replayRes.json() as { error: string };
    expect(replayData.error).toContain("Invalid, expired, or already consumed");
  });

  it("rejects malformed or forged ticket codes", async () => {
    const call = await startApi();
    const res = await call("/api/auth/canvas/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "invalid_code" }),
    });
    expect(res.status).toBe(400);
  });

  it("verifies active session via /auth/canvas/verify-session", async () => {
    const call = await startApi();
    const validRes = await call("/api/auth/canvas/verify-session", { method: "POST" }, "firebase-user-789");
    expect(validRes.status).toBe(200);
    const validData = await validRes.json() as { valid: boolean; uid: string };
    expect(validData.valid).toBe(true);
    expect(validData.uid).toBe("user-789");

    const invalidRes = await call("/api/auth/canvas/verify-session", { method: "POST" }, "bad-token");
    expect(invalidRes.status).toBe(401);
  });
});
