import { once } from "node:events";
import { createServer, type Server } from "node:http";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sealOAuthCookie } from "../lib/oauth-security";

vi.mock("jose", () => ({
  createRemoteJWKSet: () => ({}),
  jwtVerify: async (token: string) => {
    if (token !== "firebase-id-token") throw new Error("invalid token");
    return { payload: { sub: "firebase-account-1" } };
  },
}));

describe("user-owned OAuth connections", () => {
  let server: Server | undefined;
  let origin = "";

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("FIREBASE_PROJECT_ID", "ayatrisya-test");
    vi.stubEnv("GITHUB_OAUTH_CLIENT_ID", "github-test-id");
    vi.stubEnv("GITHUB_OAUTH_CLIENT_SECRET", "github-test-secret");
    vi.stubEnv("FIGMA_OAUTH_CLIENT_ID", "figma-test-id");
    vi.stubEnv("FIGMA_OAUTH_CLIENT_SECRET", "figma-test-secret");
    vi.stubEnv("SESSION_SECRET", "a-long-test-session-secret-for-oauth-cookie-tests");
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
    const { default: integrationsRouter } = await import("./integrations");
    const app = express();
    app.set("trust proxy", 1);
    app.use("/api", integrationsRouter);
    server = createServer(app).listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test server address.");
    origin = `http://127.0.0.1:${address.port}`;
    const localFetch = globalThis.fetch.bind(globalThis);
    return async (path: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      headers.set("Origin", origin);
      if (!path.endsWith("/callback") && !headers.has("Authorization")) {
        headers.set("Authorization", "Bearer firebase-id-token");
      }
      return localFetch(`${origin}${path}`, {
        ...init,
        headers,
        redirect: "manual",
      });
    };
  }

  function cookieValue(header: string | null, name: string): string {
    const match = header?.match(new RegExp(`${name}=([^;,]+)`));
    if (!match?.[1]) throw new Error(`Expected ${name} cookie.`);
    return match[1];
  }

  it("rejects connector status without a verified Firebase identity", async () => {
    const call = await startApi();
    const response = await call("/api/integrations/status", {
      headers: { Authorization: "Bearer forged-token" },
    });
    expect(response.status).toBe(401);
  });

  it("binds GitHub to the signed-in user and keeps its token out of browser responses", async () => {
    const call = await startApi();
    vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://github.com/login/oauth/access_token") {
        expect(String(init?.body)).toContain("code_verifier=");
        return new Response(JSON.stringify({
          access_token: "github-provider-token",
          expires_in: 28_800,
          refresh_token: "github-refresh-token",
          refresh_token_expires_in: 15_552_000,
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url === "https://api.github.com/user") {
        expect(new Headers(init?.headers).get("authorization")).toBe("Bearer github-provider-token");
        return new Response(JSON.stringify({ id: 42, login: "ayatri", name: "Ayatri" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`Unexpected test URL: ${url}`);
    });

    const start = await call("/api/integrations/github/start");
    expect(start.status).toBe(200);
    const authData = await start.json() as { authorizeUrl: string };
    const authUrl = new URL(authData.authorizeUrl);
    expect(authUrl.origin).toBe("https://github.com");
    expect(authUrl.searchParams.get("scope")).toBe("read:user");
    expect(authUrl.searchParams.get("code_challenge_method")).toBe("S256");
    const state = authUrl.searchParams.get("state");
    expect(state).toBeTruthy();
    const stateCookie = cookieValue(
      start.headers.get("set-cookie"),
      "ayatrisya_github_oauth_state",
    );

    const callback = await call(
      `/api/integrations/github/callback?code=authorization-code&state=${encodeURIComponent(state!)}`,
      { headers: { Cookie: `ayatrisya_github_oauth_state=${stateCookie}` } },
    );
    expect(callback.status).toBe(303);
    expect(callback.headers.get("location")).toContain("connection=connected");
    const setCookie = callback.headers.get("set-cookie");
    expect(setCookie).toContain("Path=/api/integrations");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
    const providerCookie = cookieValue(setCookie, "ayatrisya_github_connection");
    expect(providerCookie).not.toContain("github-provider-token");

    const status = await call("/api/integrations/status", {
      headers: { Cookie: `ayatrisya_github_connection=${providerCookie}` },
    });
    expect(status.status).toBe(200);
    const data = await status.json() as { github: { connected: boolean; accountName?: string } };
    expect(data.github).toMatchObject({ connected: true, accountName: "ayatri" });
    expect(JSON.stringify(data)).not.toContain("github-provider-token");
  });

  it("uses Figma's server-side Basic-auth token exchange and account-only scope", async () => {
    const call = await startApi();
    vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://api.figma.com/v1/oauth/token") {
        expect(new Headers(init?.headers).get("authorization")).toBe(
          `Basic ${Buffer.from("figma-test-id:figma-test-secret").toString("base64")}`,
        );
        expect(String(init?.body)).toContain("grant_type=authorization_code");
        expect(String(init?.body)).toContain("code_verifier=");
        return new Response(JSON.stringify({
          access_token: "figma-provider-token",
          expires_in: 3600,
          refresh_token: "figma-refresh-token",
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url === "https://api.figma.com/v1/me") {
        expect(new Headers(init?.headers).get("authorization")).toBe("Bearer figma-provider-token");
        return new Response(JSON.stringify({ id: "figma-uid", handle: "design-team" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`Unexpected test URL: ${url}`);
    });

    const start = await call("/api/integrations/figma/start");
    const authData = await start.json() as { authorizeUrl: string };
    const authUrl = new URL(authData.authorizeUrl);
    expect(authUrl.origin).toBe("https://www.figma.com");
    expect(authUrl.searchParams.get("scope")).toBe("current_user:read");
    expect(authUrl.searchParams.get("code_challenge_method")).toBe("S256");
    const state = authUrl.searchParams.get("state");
    const stateCookie = cookieValue(
      start.headers.get("set-cookie"),
      "ayatrisya_figma_oauth_state",
    );
    const callback = await call(
      `/api/integrations/figma/callback?code=figma-code&state=${encodeURIComponent(state!)}`,
      { headers: { Cookie: `ayatrisya_figma_oauth_state=${stateCookie}` } },
    );
    expect(callback.status).toBe(303);
    expect(callback.headers.get("location")).toContain("connection=connected");
    const cookie = cookieValue(
      callback.headers.get("set-cookie"),
      "ayatrisya_figma_connection",
    );
    expect(cookie).not.toContain("figma-provider-token");
  });

  it("refreshes expiring Figma tokens without exposing either token", async () => {
    const call = await startApi();
    const expiredSession = sealOAuthCookie({
      version: 1,
      provider: "figma",
      firebaseUid: "firebase-account-1",
      accessToken: "figma-old-token",
      refreshToken: "figma-live-refresh",
      accountName: "design-team",
      expiresAt: Date.now() - 1000,
      refreshExpiresAt: Date.now() + 60_000,
    });
    vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe("https://api.figma.com/v1/oauth/refresh");
      expect(new Headers(init?.headers).get("authorization")).toBe(
        `Basic ${Buffer.from("figma-test-id:figma-test-secret").toString("base64")}`,
      );
      expect(String(init?.body)).toContain("refresh_token=figma-live-refresh");
      return new Response(JSON.stringify({ access_token: "figma-new-token", expires_in: 3600 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const response = await call("/api/integrations/status", {
      headers: { Cookie: `ayatrisya_figma_connection=${expiredSession}` },
    });
    expect(response.status).toBe(200);
    const data = await response.json() as { figma: { connected: boolean; accountName?: string } };
    expect(data.figma).toMatchObject({
      connected: true,
      accountName: "design-team",
    });
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).not.toContain("figma-new-token");
    expect(cookieValue(setCookie, "ayatrisya_figma_connection")).not.toBe(expiredSession);
  });
});
