import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createOAuthState,
  createPkcePair,
  openOAuthCookie,
  sealOAuthCookie,
} from "./oauth-security";

describe("OAuth cookie security", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", "a-long-test-session-secret-for-oauth-cookie-tests");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("encrypts and opens cookie payloads", () => {
    const payload = { accessToken: "never-in-client", provider: "github" };
    const sealed = sealOAuthCookie(payload);
    expect(sealed).not.toContain(payload.accessToken);
    expect(openOAuthCookie<typeof payload>(sealed)).toEqual(payload);
  });

  it("rejects tampered cookie payloads", () => {
    const sealed = sealOAuthCookie({ uid: "account-1", accessToken: "protected" });
    const parts = sealed.split(".");
    const ciphertext = parts[3] ?? "";
    parts[3] = `${ciphertext[0] === "a" ? "b" : "a"}${ciphertext.slice(1)}`;
    expect(openOAuthCookie(parts.join("."))).toBeUndefined();
  });

  it("rejects malformed or unsupported cookie versions", () => {
    expect(openOAuthCookie("v2.not.a.cookie")).toBeUndefined();
    expect(openOAuthCookie("")).toBeUndefined();
    expect(openOAuthCookie(undefined)).toBeUndefined();
  });

  it("requires a sufficiently long server-side session secret", () => {
    vi.stubEnv("SESSION_SECRET", "short");
    expect(() => sealOAuthCookie({ value: true })).toThrow(/SESSION_SECRET/);
  });

  it("creates a valid S256 PKCE pair and independent state values", () => {
    const pair = createPkcePair();
    expect(pair.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(pair.challenge).toBe(
      createHash("sha256").update(pair.verifier).digest("base64url"),
    );
    expect(pair.challenge).not.toBe(pair.verifier);
    expect(createOAuthState()).not.toBe(createOAuthState());
  });
});
