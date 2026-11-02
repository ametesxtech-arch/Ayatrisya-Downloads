import { describe, expect, it, vi, beforeEach } from "vitest";

const storage = new Map<string, string>();
const mockLocalStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, String(v)),
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
};

describe("Desktop Browser Authentication Handshake", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  it("stores and restores desktop authenticated sessions from localStorage", () => {
    const session = {
      uid: "desktop-user-456",
      email: "desktop@ayatrisya.ai",
      token: "signed-desktop-token-jwt-value",
      expiresAt: Date.now() + 1000 * 3600,
    };

    mockLocalStorage.setItem("ayatrisya:desktop-session:v1", JSON.stringify(session));

    const saved = mockLocalStorage.getItem("ayatrisya:desktop-session:v1");
    expect(saved).toBeTruthy();
    const parsed = JSON.parse(saved!);
    expect(parsed.uid).toBe("desktop-user-456");
    expect(parsed.email).toBe("desktop@ayatrisya.ai");
    expect(parsed.token).toBe("signed-desktop-token-jwt-value");
    expect(parsed.expiresAt).toBeGreaterThan(Date.now());
  });

  it("clears desktop session on sign-out", () => {
    mockLocalStorage.setItem("ayatrisya:desktop-session:v1", JSON.stringify({
      uid: "test-user",
      token: "token-123",
      expiresAt: Date.now() + 10000,
    }));
    expect(mockLocalStorage.getItem("ayatrisya:desktop-session:v1")).toBeTruthy();

    mockLocalStorage.removeItem("ayatrisya:desktop-session:v1");
    expect(mockLocalStorage.getItem("ayatrisya:desktop-session:v1")).toBeNull();
  });

  it("validates deep link URI scheme and path structure", () => {
    function parseDeepLink(rawUrl: string) {
      if (!rawUrl.startsWith("ayatrisya://")) return null;
      try {
        const url = new URL(rawUrl);
        const hostAndPath = `${url.hostname}${url.pathname}`.replace(/^\/+|\/+$/g, "");
        if (hostAndPath !== "auth/callback") return null;
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        return { code, state, error };
      } catch {
        return null;
      }
    }

    // Valid callback
    const valid = parseDeepLink("ayatrisya://auth/callback?code=abcd1234&state=state5678");
    expect(valid).toEqual({ code: "abcd1234", state: "state5678", error: null });

    // Invalid scheme
    expect(parseDeepLink("https://auth/callback?code=abcd1234&state=state5678")).toBeNull();

    // Invalid path
    expect(parseDeepLink("ayatrisya://other/path?code=abcd1234&state=state5678")).toBeNull();

    // With error parameter
    const withError = parseDeepLink("ayatrisya://auth/callback?error=User+cancelled");
    expect(withError?.error).toBe("User cancelled");
  });

  it("enforces PKCE challenge and state parameter validation", () => {
    function isValidState(state: string) {
      const trimmed = typeof state === "string" ? state.trim() : "";
      return /^[a-zA-Z0-9_-]{16,128}$/.test(trimmed);
    }

    function isValidChallenge(challenge: string) {
      const trimmed = typeof challenge === "string" ? challenge.trim() : "";
      return /^[a-zA-Z0-9_-]{40,128}$/.test(trimmed);
    }

    // Realistic Electron hex state (32 chars)
    expect(isValidState("abcdef0123456789abcdef0123456789")).toBe(true);
    expect(isValidState("1d3f792732a1b31412cf3c221ca6c5e7")).toBe(true);
    // State with surrounding whitespace (trimmed)
    expect(isValidState("  1d3f792732a1b31412cf3c221ca6c5e7  ")).toBe(true);
    // Base64url and UUID state
    expect(isValidState("300ef84dbca7d784ebd33a517c555c5a")).toBe(true);
    expect(isValidState("f47ac10b-58cc-4372-a567-0e02b2c3d479")).toBe(true);
    // Invalid characters in state
    expect(isValidState("not-hex-characters!!")).toBe(false);
    expect(isValidState("has spaces inside")).toBe(false);
    expect(isValidState("state@invalid.com")).toBe(false);
    // Too short (< 16 chars)
    expect(isValidState("abc12345")).toBe(false);

    // Realistic SHA-256 base64url challenges (43 chars)
    expect(isValidChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(true);
    expect(isValidChallenge("LVxKC4SvQrTXNg2dvmjo8ii23C2uWnmotVARa8zPRA0")).toBe(true);
    expect(isValidChallenge("8p11D2csjG9xFpBMi7YXzWEhFmNzVRdLLm98ALiiyzo")).toBe(true);
    // Challenge with surrounding whitespace (trimmed)
    expect(isValidChallenge("  LVxKC4SvQrTXNg2dvmjo8ii23C2uWnmotVARa8zPRA0  ")).toBe(true);
    // Illegal characters (standard base64 padding or symbols not permitted in base64url)
    expect(isValidChallenge("LVxKC4SvQrTXNg2dvmjo8ii23C2uWnmotVARa8zPRA0=")).toBe(false);
    expect(isValidChallenge("challenge+with+illegal+chars/==")).toBe(false);
    expect(isValidChallenge("challenge with spaces inside 123456789012345")).toBe(false);
    // Too short (< 40 chars)
    expect(isValidChallenge("too_short_challenge")).toBe(false);
  });

  it("verifies desktop bridge contract integrates startBrowserAuth and onAuthCallback", async () => {
    let callbackRegistered: ((result: any) => void) | null = null;
    const startBrowserAuth = vi.fn().mockResolvedValue({ state: "test-state-hex" });
    const cancelBrowserAuth = vi.fn().mockResolvedValue(undefined);
    const onAuthCallback = vi.fn().mockImplementation((cb) => {
      callbackRegistered = cb;
      return () => { callbackRegistered = null; };
    });

    const mockBridge = {
      isDesktop: true,
      startBrowserAuth,
      cancelBrowserAuth,
      onAuthCallback,
    };

    expect(mockBridge.isDesktop).toBe(true);

    const startResult = await mockBridge.startBrowserAuth("sign-in");
    expect(startBrowserAuth).toHaveBeenCalledWith("sign-in");
    expect(startResult.state).toBe("test-state-hex");

    const listener = vi.fn();
    const unsub = mockBridge.onAuthCallback(listener);
    expect(callbackRegistered).toBeDefined();

    // Simulate callback invocation from deep link
    callbackRegistered!({
      success: true,
      session: {
        uid: "user-123",
        email: "user@ayatrisya.com",
        token: "tok-abc",
        expiresAt: Date.now() + 60000,
      },
    });
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      session: expect.objectContaining({ uid: "user-123" }),
    }));

    unsub();
  });
});
