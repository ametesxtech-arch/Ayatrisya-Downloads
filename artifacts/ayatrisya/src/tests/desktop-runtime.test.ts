import { describe, expect, it } from "vitest";
import { validateDesktopRuntimeInfo } from "../desktop/runtime";

describe("desktop bridge capability handshake", () => {
  it("accepts only the supported version and reports actual local model capabilities", () => {
    expect(validateDesktopRuntimeInfo({
      bridgeName: "ayatrisya-desktop",
      apiVersion: 1,
      appVersion: "2.4.0",
      platform: "linux",
      capabilities: ["local-model-ipc", "unsupported-capability"],
      localModel: {
        endpointConfigured: true,
        models: [
          { id: "v1-fast", available: true, modalities: ["chat", "music"] },
          { id: "not-a-model", available: true, modalities: ["chat"] },
        ],
      },
    })).toEqual({
      bridgeName: "ayatrisya-desktop",
      apiVersion: 1,
      appVersion: "2.4.0",
      platform: "linux",
      capabilities: ["local-model-ipc"],
      localModel: {
        endpointConfigured: true,
        models: [{ id: "v1-fast", available: true, modalities: ["chat", "music"] }],
      },
    });
  });

  it("rejects missing, malformed, or unsupported bridge handshakes", () => {
    expect(validateDesktopRuntimeInfo(null)).toBeNull();
    expect(validateDesktopRuntimeInfo({
      bridgeName: "ayatrisya-desktop",
      apiVersion: 2,
      appVersion: "2.4.0",
      platform: "linux",
      capabilities: [],
      localModel: { endpointConfigured: false, models: [] },
    })).toBeNull();
    expect(validateDesktopRuntimeInfo({
      bridgeName: "other-app",
      apiVersion: 1,
      appVersion: "2.4.0",
      platform: "linux",
      capabilities: [],
      localModel: { endpointConfigured: false, models: [] },
    })).toBeNull();
  });
});
