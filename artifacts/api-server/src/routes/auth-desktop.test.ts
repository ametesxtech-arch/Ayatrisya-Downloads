import { createHash } from "node:crypto";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jwtVerify } from "jose";

vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jose")>();
  return {
    ...actual,
    createRemoteJWKSet: () => ({}),
    jwtVerify: async (token: string, key: unknown, options?: unknown) => {
      if (token === "valid-firebase-id-token") {
        return { payload: { sub: "firebase-desktop-user-123" } };
      }
      return actual.jwtVerify(token, key as any, options as any);
    },
  };
});

describe("Desktop Browser Authentication Handshake", () => {
  let server: Server | undefined;
  let origin = "";

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("FIREBASE_PROJECT_ID", "ayatrisya-test");
    vi.stubEnv("SESSION_SECRET", "super-secret-session-key-minimum-32-chars-long-test");
  });

  afterEach(async () => {
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
    const { default: authDesktopRouter } = await import("./auth-desktop");
    const app = express();
    app.use(express.json());
    app.use("/api", authDesktopRouter);
    server = createServer(app).listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test server address.");
    origin = `http://127.0.0.1:${address.port}`;
    return async (path: string, init: RequestInit = {}) => {
      return fetch(`${origin}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...init.headers,
        },
      });
    };
  }

  it("rejects desktop handoff request without valid Firebase identity", async () => {
    const call = await startApi();
    const res = await call("/api/auth/desktop/handoff", {
      method: "POST",
      headers: { Authorization: "Bearer forged-token" },
      body: JSON.stringify({ state: "0123456789abcdef0123456789abcdef", challenge: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk" }),
    });
    expect(res.status).toBe(401);
  });

  it("completes full PKCE flow: handoff creation, exchange, and single-use enforcement", async () => {
    const call = await startApi();

    // 1. Generate PKCE pair
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk-random-verifier-string-12345";
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const state = "abcdef0123456789abcdef0123456789";

    // 2. Web browser initiates handoff with verified user token
    const handoffRes = await call("/api/auth/desktop/handoff", {
      method: "POST",
      headers: { Authorization: "Bearer valid-firebase-id-token" },
      body: JSON.stringify({ state, challenge, email: "user@ayatrisya.com" }),
    });
    expect(handoffRes.status).toBe(200);
    const { code } = (await handoffRes.json()) as { code: string };
    expect(code).toBeTruthy();
    expect(code.length).toBe(64); // 32 bytes hex

    // 3. Desktop app exchanges code + verifier
    const exchangeRes = await call("/api/auth/desktop/exchange", {
      method: "POST",
      body: JSON.stringify({ code, verifier, state }),
    });
    expect(exchangeRes.status).toBe(200);
    const session = (await exchangeRes.json()) as { uid: string; email: string; token: string };
    expect(session.uid).toBe("firebase-desktop-user-123");
    expect(session.email).toBe("user@ayatrisya.com");
    expect(session.token).toBeTruthy();

    // 4. Verify token is verifiable with SESSION_SECRET
    const secret = new TextEncoder().encode("super-secret-session-key-minimum-32-chars-long-test");
    const verified = await jwtVerify(session.token, secret, {
      issuer: "ayatrisya-api",
      audience: "ayatrisya-desktop",
    });
    expect(verified.payload.sub).toBe("firebase-desktop-user-123");

    // 5. Replay attack: Re-exchanging the same code must fail immediately
    const replayRes = await call("/api/auth/desktop/exchange", {
      method: "POST",
      body: JSON.stringify({ code, verifier, state }),
    });
    expect(replayRes.status).toBe(400);
    const replayBody = (await replayRes.json()) as { error: string };
    expect(replayBody.error).toContain("expired or was already used");
  });

  it("rejects exchange when PKCE verifier does not match challenge", async () => {
    const call = await startApi();
    const verifier = "correct-verifier-string-value-123456789012345";
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const state = "a1b2c3d4e5f60123456789abcdef0123";

    const handoffRes = await call("/api/auth/desktop/handoff", {
      method: "POST",
      headers: { Authorization: "Bearer valid-firebase-id-token" },
      body: JSON.stringify({ state, challenge }),
    });
    expect(handoffRes.status).toBe(200);
    const { code } = (await handoffRes.json()) as { code: string };

    const badExchange = await call("/api/auth/desktop/exchange", {
      method: "POST",
      body: JSON.stringify({ code, verifier: "wrong-verifier-attempt-1234567890", state }),
    });
    expect(badExchange.status).toBe(401);
    const badBody = (await badExchange.json()) as { error: string };
    expect(badBody.error).toContain("Invalid PKCE proof of possession");
  });

  it("rejects exchange when state parameter mismatches (CSRF mitigation)", async () => {
    const call = await startApi();
    const verifier = "verifier-string-test-value-123456789012345678";
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const state = "c1d2e3f4a5b60123456789abcdef0123";

    const handoffRes = await call("/api/auth/desktop/handoff", {
      method: "POST",
      headers: { Authorization: "Bearer valid-firebase-id-token" },
      body: JSON.stringify({ state, challenge }),
    });
    expect(handoffRes.status).toBe(200);
    const { code } = (await handoffRes.json()) as { code: string };

    const mismatchedStateExchange = await call("/api/auth/desktop/exchange", {
      method: "POST",
      body: JSON.stringify({ code, verifier, state: "ffffffffffff0123456789abcdef0123" }),
    });
    expect(mismatchedStateExchange.status).toBe(400);
    const errBody = (await mismatchedStateExchange.json()) as { error: string };
    expect(errBody.error).toContain("state mismatch");
  });
});
