import { describe, expect, it } from "vitest";
import { detectDevicePlatform } from "@/pwa/device";

describe("PWA device recommendation", () => {
  it("uses platform hints for desktop installer recommendations", () => {
    expect(detectDevicePlatform({ userAgentDataPlatform: "Windows" })).toBe("windows");
    expect(detectDevicePlatform({ platform: "MacIntel" })).toBe("macos");
    expect(detectDevicePlatform({ userAgent: "X11; Linux x86_64" })).toBe("linux");
  });

  it("recognizes mobile platforms for PWA-first installation guidance", () => {
    expect(detectDevicePlatform({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" })).toBe("ios");
    expect(detectDevicePlatform({ userAgentDataPlatform: "Android" })).toBe("android");
    expect(detectDevicePlatform({ platform: "MacIntel", maxTouchPoints: 5 })).toBe("ios");
  });

  it("does not guess an unknown platform", () => {
    expect(detectDevicePlatform({})).toBe("unknown");
  });
});
