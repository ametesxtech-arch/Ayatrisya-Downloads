import { describe, expect, it } from "vitest";
import { isAllowedApiOrigin } from "./cors-policy";

describe("API CORS policy", () => {
  it("allows the exact configured production app origin", () => {
    expect(isAllowedApiOrigin("https://ayatrisya.example", {
      NODE_ENV: "production",
      AYATRISYA_APP_ORIGIN: "https://ayatrisya.example",
    })).toBe(true);
  });

  it("allows explicitly configured Replit domains, not sibling domains", () => {
    const environment = {
      NODE_ENV: "production",
      REPLIT_DOMAINS: "ayatrisya.replit.app",
    };
    expect(isAllowedApiOrigin("https://ayatrisya.replit.app", environment)).toBe(true);
    expect(isAllowedApiOrigin("https://attacker.replit.app", environment)).toBe(false);
  });

  it("allows loopback origins only outside production", () => {
    expect(isAllowedApiOrigin("http://localhost:5173", {
      NODE_ENV: "development",
    })).toBe(true);
    expect(isAllowedApiOrigin("http://localhost:5173", {
      NODE_ENV: "production",
    })).toBe(false);
  });

  it("rejects missing, malformed, insecure, and unconfigured origins", () => {
    const environment = {
      NODE_ENV: "production",
      AYATRISYA_APP_ORIGIN: "https://ayatrisya.example",
    };
    expect(isAllowedApiOrigin(undefined, environment)).toBe(false);
    expect(isAllowedApiOrigin("null", environment)).toBe(false);
    expect(isAllowedApiOrigin("http://ayatrisya.example", environment)).toBe(false);
    expect(isAllowedApiOrigin("https://ayatrisya.example.evil.test", environment)).toBe(false);
  });
});
