import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { validateApiEndpoint, buildApiUrl, apiFetch, getApiBaseUrl } from "@/lib/api-config";
import {
  resolveExecutionRouting,
  canCapabilityRunOnCloud,
  assertExecutionAllowed,
  RoutingPolicyError,
  type ExecutionTarget,
} from "@/ai/execution-policy";
import { AyatrisyaModelClient } from "@/ai/client";
import { AyatrisyaRemoteClient, type RemoteJob } from "@/ai/remote-client";
import type { VerifiedDesktopRuntime } from "@/desktop/runtime";
import type { AyatrisyaDesktopApi } from "@/desktop/contracts";

describe("Phase 1 & 2: API Base URL & Production Gateway Configuration", () => {
  it("rejects localhost and loopback URLs in production mode", () => {
    const localhostResult = validateApiEndpoint("http://localhost:3000", true);
    expect(localhostResult.valid).toBe(false);
    expect(localhostResult.error).toMatch(/cannot use localhost or loopback/i);

    const loopbackResult = validateApiEndpoint("http://127.0.0.1:4199", true);
    expect(loopbackResult.valid).toBe(false);
    expect(loopbackResult.error).toMatch(/cannot use localhost or loopback/i);
  });

  it("rejects unencrypted HTTP URLs in production mode", () => {
    const httpResult = validateApiEndpoint("http://ayatrisya-model.onrender.com", true);
    expect(httpResult.valid).toBe(false);
    expect(httpResult.error).toMatch(/must use HTTPS/i);
  });

  it("accepts valid HTTPS Render API endpoints in production mode", () => {
    const validResult = validateApiEndpoint("https://ayatrisya-model.onrender.com", true);
    expect(validResult.valid).toBe(true);
    expect(validResult.error).toBeUndefined();
  });

  it("buildApiUrl correctly joins base URL and paths", () => {
    const url = buildApiUrl("/api/model/chat");
    expect(url).toMatch(/\/api\/model\/chat$/);
  });

  it("apiFetch detects and rejects HTML error pages instead of parsing as JSON", async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      new Response("<!DOCTYPE html><html><body>404 Not Found</body></html>", {
        status: 404,
        headers: { "Content-Type": "text/html" },
      }),
    );
    vi.stubGlobal("fetch", fakeFetch);

    await expect(apiFetch("/api/model/health")).rejects.toThrow(/HTML/i);
    vi.unstubAllGlobals();
  });

  it("apiFetch respects timeout and cancellation", async () => {
    const controller = new AbortController();
    controller.abort(new DOMException("User aborted.", "AbortError"));

    await expect(apiFetch("/api/model/health", { signal: controller.signal })).rejects.toThrow(/cancelled/i);
  });
});

describe("Phase 3 & 4: Typed Execution Routing & Capability Checks", () => {
  it("enforces that 3D generation is strictly desktop-only and cannot run on cloud", () => {
    expect(canCapabilityRunOnCloud("3d")).toBe(false);

    const decision = resolveExecutionRouting({
      capability: "3d",
      targetPolicy: "cloud_model",
      isNativeDesktop: false,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.error).toMatch(/strictly local desktop-only/i);
    expect(() => assertExecutionAllowed(decision)).toThrow(RoutingPolicyError);
  });

  it("enforces that coding command execution and project tools require desktop", () => {
    expect(canCapabilityRunOnCloud("coding")).toBe(false);
    expect(canCapabilityRunOnCloud("game-build")).toBe(false);
    expect(canCapabilityRunOnCloud("project-file")).toBe(false);

    const decision = resolveExecutionRouting({
      capability: "coding",
      targetPolicy: "cloud_model",
      isNativeDesktop: false,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.error).toMatch(/strictly local desktop-only/i);
  });

  it("routes desktop-only capabilities to desktop IPC when running natively", () => {
    const decision = resolveExecutionRouting({
      capability: "3d",
      isNativeDesktop: true,
      hasLocalModel: true,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.route).toBe("desktop_ipc");
    expect(decision.target).toBe("local_desktop");
  });

  it("routes desktop-only capabilities to Remote Access gateway when paired", () => {
    const decision = resolveExecutionRouting({
      capability: "3d",
      isNativeDesktop: false,
      isRemoteDesktopPaired: true,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.route).toBe("remote_access_gateway");
    expect(decision.target).toBe("local_desktop");
  });

  it("fails closed with clear error when desktop is offline for desktop-only capabilities", () => {
    const decision = resolveExecutionRouting({
      capability: "3d",
      isNativeDesktop: false,
      isRemoteDesktopPaired: false,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.error).toMatch(/Ayatrisya Desktop is offline or unreachable/i);
  });

  it("local_desktop policy NEVER silently falls back to cloud", () => {
    const decision = resolveExecutionRouting({
      capability: "chat",
      targetPolicy: "local_desktop",
      isNativeDesktop: false,
      isRemoteDesktopPaired: false,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.target).toBe("local_desktop");
    expect(decision.error).toMatch(/Cloud fallback is disabled for Local Only requests/i);
  });

  it("auto policy chooses native desktop if model is ready, otherwise cloud gateway", () => {
    const onDevice = resolveExecutionRouting({
      capability: "chat",
      targetPolicy: "auto",
      isNativeDesktop: true,
      hasLocalModel: true,
    });
    expect(onDevice.allowed).toBe(true);
    expect(onDevice.target).toBe("local_desktop");
    expect(onDevice.route).toBe("desktop_ipc");

    const onWeb = resolveExecutionRouting({
      capability: "chat",
      targetPolicy: "auto",
      isNativeDesktop: false,
      isRemoteDesktopPaired: false,
    });
    expect(onWeb.allowed).toBe(true);
    expect(onWeb.target).toBe("cloud_model");
    expect(onWeb.route).toBe("cloud_gateway");
  });
});

describe("Phase 3 & 4: AyatrisyaModelClient Policy Enforcement", () => {
  it("refuses to route to cloud when setTargetPolicy is local_desktop and desktop is offline", async () => {
    const client = new AyatrisyaModelClient(
      async () => "mock-token",
      async () => null, // No desktop runtime
    );
    client.setTargetPolicy("local_desktop");

    await expect(
      client.generateResponse([{ role: "user", content: "Hello" }], {
        model: "v1-fast",
        mode: "Normal",
      }),
    ).rejects.toThrow(/Local desktop execution was selected, but the desktop is offline/i);
  });

  it("refuses 3D generation when target policy is cloud_model", async () => {
    const client = new AyatrisyaModelClient(
      async () => "mock-token",
      async () => null,
    );
    client.setTargetPolicy("cloud_model");

    await expect(
      client.generateAsset("3d", "a 3D spacecraft", {
        model: "v1-fast",
        format: "GLB",
      }),
    ).rejects.toThrow(/3D model generation is strictly local desktop-only/i);
  });

  it("reports missing desktop honestly for 3D generation without simulating success", async () => {
    const client = new AyatrisyaModelClient(
      async () => "mock-token",
      async () => null,
    );
    client.setTargetPolicy("local_desktop");

    await expect(
      client.generateAsset("3d", "a 3D spacecraft", {
        model: "v1-fast",
        format: "GLB",
      }),
    ).rejects.toThrow(/Local desktop execution was selected, but the desktop is offline/i);
  });
});

describe("Phase 5: Remote Access Workflow & Honest Execution Status", () => {
  it("submits remote jobs and coding commands through the API layer", async () => {
    const remote = new AyatrisyaRemoteClient();
    const fakeFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/remote/coding/execute")) {
        return Promise.resolve(
          new Response(JSON.stringify({ jobId: "job-123", state: "queued", deviceId: "device-desk-1" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      if (url.includes("/api/remote/devices")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              devices: [
                {
                  deviceId: "device-desk-1",
                  deviceName: "Workstation",
                  platform: "windows",
                  status: "idle",
                  capabilities: ["coding", "3d"],
                  lastSeenAt: new Date().toISOString(),
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      return Promise.reject(new Error("Unexpected URL: " + url));
    });
    vi.stubGlobal("fetch", fakeFetch);

    const devices = await remote.listDevices();
    expect(devices).toHaveLength(1);
    expect(devices[0].deviceName).toBe("Workstation");

    const job = await remote.executeCodingCommand({ command: "npm test", projectId: "proj-1" });
    expect(job.jobId).toBe("job-123");
    expect(job.state).toBe("queued");

    vi.unstubAllGlobals();
  });

  it("pollJobUntilDone never reports success until state is completed", async () => {
    const remote = new AyatrisyaRemoteClient();
    let pollCount = 0;

    const fakeFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/remote/jobs/job-xyz")) {
        pollCount++;
        const state = pollCount === 1 ? "queued" : pollCount === 2 ? "running" : "completed";
        const job: RemoteJob = {
          jobId: "job-xyz",
          userUid: "user-1",
          deviceId: "device-1",
          capability: "coding",
          action: "run-command",
          state,
          progress: pollCount * 33,
          result: state === "completed" ? { exitCode: 0, output: "Tests passed." } : undefined,
          createdAt: new Date().toISOString(),
        };
        return Promise.resolve(
          new Response(JSON.stringify({ job }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return Promise.reject(new Error("Unexpected URL: " + url));
    });
    vi.stubGlobal("fetch", fakeFetch);

    const finalJob = await remote.pollJobUntilDone("job-xyz", { pollIntervalMs: 10 });
    expect(finalJob.state).toBe("completed");
    expect(pollCount).toBe(3);
    expect(finalJob.result).toEqual({ exitCode: 0, output: "Tests passed." });

    vi.unstubAllGlobals();
  });

  it("pollJobUntilDone reports error honestly when desktop job fails", async () => {
    const remote = new AyatrisyaRemoteClient();
    const fakeFetch = vi.fn().mockImplementation((url: string) => {
      const job: RemoteJob = {
        jobId: "job-fail",
        userUid: "user-1",
        deviceId: "device-1",
        capability: "coding",
        action: "run-command",
        state: "failed",
        error: "Compilation failed: syntax error in main.rs",
        createdAt: new Date().toISOString(),
      };
      return Promise.resolve(
        new Response(JSON.stringify({ job }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
    vi.stubGlobal("fetch", fakeFetch);

    await expect(remote.pollJobUntilDone("job-fail", { pollIntervalMs: 10 })).rejects.toThrow(
      /Compilation failed: syntax error/i,
    );

    vi.unstubAllGlobals();
  });
});
