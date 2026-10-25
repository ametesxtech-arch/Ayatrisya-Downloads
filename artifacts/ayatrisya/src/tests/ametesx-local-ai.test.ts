import { describe, expect, it } from "vitest";
import {
  evaluateHardwareProfile,
  type SystemHardwareSpecs,
} from "../desktop/hardware";
import {
  AMETESX_MODEL_REGISTRY,
  getModelById,
  getModelsForTier,
  getSpecialistModels,
} from "../desktop/model-registry";
import { AmetesxModelProvisioner } from "../desktop/provisioner";
import { AmetesxResourceGuard } from "../desktop/resource-guard";
import { AmetesxOfflineGuard } from "../desktop/offline-mode";
import { AmetesxGameAgent } from "../desktop/game-agent";
import {
  AmetesxProjectExporter,
  createInMemoryZip,
  validateGlbBinary,
  validateWavAudio,
  validateWindowsExecutable,
  validateZipArchive,
} from "../desktop/exporter";

describe("Ametesx Local AI Engine - Hardware Detection & Adaptive Profiles", () => {
  it("recommends LITE profile for low-end systems with <= 8 GB RAM and integrated GPU", () => {
    const lowEndSpecs: SystemHardwareSpecs = {
      os: "win32",
      arch: "x64",
      cpuModel: "Intel Core i3-1115G4",
      cpuCores: 4,
      totalRamGb: 8,
      availableRamGb: 4.2,
      gpuVendor: "INTEL",
      gpuModel: "Intel UHD Graphics",
      vramGb: 0,
      freeDiskSpaceGb: 40,
      hasCuda: false,
      hasMetal: false,
      hasDirectMl: true,
    };

    const budget = evaluateHardwareProfile(lowEndSpecs);
    expect(budget.recommendedTier).toBe("LITE");
    expect(budget.tierScore).toBe(1);
    expect(budget.reservedRamGb).toBe(2.0); // 2 GB reserved for OS/UI
    expect(budget.maxModelRamGb).toBeLessThanOrEqual(5.5);
    expect(budget.maxContextTokens).toBe(4096);
    expect(budget.maxConcurrency).toBe(1);
    expect(budget.eligibleModelIds).toContain("qwen2.5-coder-1.5b-instruct-q4_k_m");
  });

  it("recommends STANDARD profile for mainstream machines with 16 GB RAM and 4-6 GB VRAM", () => {
    const mainstreamSpecs: SystemHardwareSpecs = {
      os: "win32",
      arch: "x64",
      cpuModel: "AMD Ryzen 5 5600H",
      cpuCores: 12,
      totalRamGb: 16,
      availableRamGb: 9.5,
      gpuVendor: "NVIDIA",
      gpuModel: "NVIDIA GeForce RTX 3050 Laptop GPU",
      vramGb: 4.0,
      freeDiskSpaceGb: 120,
      hasCuda: true,
      hasMetal: false,
      hasDirectMl: true,
    };

    const budget = evaluateHardwareProfile(mainstreamSpecs);
    expect(budget.recommendedTier).toBe("STANDARD");
    expect(budget.tierScore).toBe(2);
    expect(budget.reservedRamGb).toBe(3.0);
    expect(budget.maxContextTokens).toBe(8192);
    expect(budget.maxConcurrency).toBe(1);
    expect(budget.eligibleModelIds).toContain("qwen2.5-coder-7b-instruct-q4_k_m");
  });

  it("recommends MAX profile for high-end workstations with >= 16 GB RAM and >= 8 GB VRAM", () => {
    const workstationSpecs: SystemHardwareSpecs = {
      os: "win32",
      arch: "x64",
      cpuModel: "AMD Ryzen 9 7950X",
      cpuCores: 32,
      totalRamGb: 64,
      availableRamGb: 48,
      gpuVendor: "NVIDIA",
      gpuModel: "NVIDIA GeForce RTX 4090",
      vramGb: 24.0,
      freeDiskSpaceGb: 800,
      hasCuda: true,
      hasMetal: false,
      hasDirectMl: true,
    };

    const budget = evaluateHardwareProfile(workstationSpecs);
    expect(budget.recommendedTier).toBe("MAX");
    expect(budget.tierScore).toBe(3);
    expect(budget.reservedRamGb).toBe(4.0);
    expect(budget.maxContextTokens).toBe(16384);
    expect(budget.maxConcurrency).toBe(2); // RTX 4090 supports concurrent worker
    expect(budget.eligibleModelIds).toContain("nvidia-nemotron-mini-4b-instruct-q4_k_m");
    expect(budget.eligibleModelIds).toContain("qwen2.5-coder-32b-instruct-q4_k_m");
  });

  it("issues warning notes when disk space is under 10 GB or RAM is severely constrained", () => {
    const constrainedSpecs: SystemHardwareSpecs = {
      os: "win32",
      arch: "x64",
      cpuModel: "Intel Celeron N4020",
      cpuCores: 2,
      totalRamGb: 4,
      availableRamGb: 1.2,
      gpuVendor: "INTEL",
      gpuModel: "Intel HD Graphics",
      vramGb: 0,
      freeDiskSpaceGb: 6, // Low disk
      hasCuda: false,
      hasMetal: false,
      hasDirectMl: false,
    };

    const budget = evaluateHardwareProfile(constrainedSpecs);
    expect(budget.recommendedTier).toBe("LITE");
    expect(budget.warningNotes.some((w) => w.includes("Low disk space"))).toBe(true);
    expect(budget.warningNotes.some((w) => w.includes("System RAM is under 8 GB"))).toBe(true);
  });
});

describe("Ametesx Model Registry & License Verification", () => {
  it("contains verified candidate models with valid licenses, checksums, and memory estimates", () => {
    expect(Object.keys(AMETESX_MODEL_REGISTRY).length).toBeGreaterThanOrEqual(7);

    for (const [id, model] of Object.entries(AMETESX_MODEL_REGISTRY)) {
      expect(model.id).toBe(id);
      expect(model.name).toBeTruthy();
      expect(["LITE", "STANDARD", "MAX"]).toContain(model.tier);
      expect(model.diskSizeBytes).toBeGreaterThan(100_000_000); // at least 100MB
      expect(model.diskSizeGb).toBeGreaterThan(0.1);
      expect(model.minRamGb).toBeGreaterThan(0);
      expect(model.expectedSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(model.license).toBeTruthy();
      expect(model.licenseUrl).toMatch(/^https?:\/\//);
      expect(model.downloadSource).toMatch(/^https?:\/\//);
    }
  });

  it("provides NVIDIA Nemotron model with official NVIDIA Open Model License and CUDA runtime", () => {
    const nemotron = getModelById("nvidia-nemotron-mini-4b-instruct-q4_k_m");
    expect(nemotron).toBeDefined();
    expect(nemotron!.architecture).toBe("nemotron");
    expect(nemotron!.license).toBe("NVIDIA Open Model License");
    expect(nemotron!.supportedRuntimes).toContain("llama-cpp");
    expect(nemotron!.minVramGb).toBe(4.0);
  });

  it("provides specialist local models for 3D mesh and music generation", () => {
    const specialists = getSpecialistModels();
    expect(specialists.length).toBeGreaterThanOrEqual(2);

    const model3d = specialists.find((m) => m.modalities.includes("3d"));
    expect(model3d).toBeDefined();
    expect(model3d!.id).toBe("triposr-mesh-gen-fp16");
    expect(model3d!.license).toBe("MIT");

    const musicModel = specialists.find((m) => m.modalities.includes("music"));
    expect(musicModel).toBeDefined();
    expect(musicModel!.id).toBe("musicgen-small-local");
    expect(musicModel!.license).toBe("MIT");
  });

  it("filters general models by hardware tier correctly", () => {
    const liteModels = getModelsForTier("LITE");
    expect(liteModels.every((m) => m.tier === "LITE" && !m.isSpecialist)).toBe(true);

    const standardModels = getModelsForTier("STANDARD");
    expect(standardModels.every((m) => m.tier === "STANDARD" && !m.isSpecialist)).toBe(true);

    const maxModels = getModelsForTier("MAX");
    expect(maxModels.every((m) => m.tier === "MAX" && !m.isSpecialist)).toBe(true);
  });
});

describe("Ametesx Model Provisioner Lifecycle & Integrity", () => {
  it("requires user confirmation before downloading and calculates expected disk usage", () => {
    const provisioner = new AmetesxModelProvisioner();
    const specs: SystemHardwareSpecs = {
      os: "win32",
      arch: "x64",
      cpuModel: "Intel Core i7",
      cpuCores: 8,
      totalRamGb: 16,
      availableRamGb: 10,
      gpuVendor: "NVIDIA",
      gpuModel: "RTX 3060",
      vramGb: 6,
      freeDiskSpaceGb: 50,
      hasCuda: true,
      hasMetal: false,
      hasDirectMl: true,
    };

    const plan = provisioner.prepareInitialPackage("STANDARD", specs);
    expect(plan.recommendedModel.id).toBe("qwen2.5-coder-7b-instruct-q4_k_m");
    expect(plan.requiredDiskBytes).toBe(plan.recommendedModel.diskSizeBytes);
    expect(plan.sufficientDiskSpace).toBe(true);
    expect(plan.confirmationPrompt).toContain("Download Ametesx Coder Standard 7B");

    const status = provisioner.getStatus();
    expect(status?.state).toBe("CONFIRMATION_REQUIRED");
  });

  it("tracks progress, verifies checksum, runs smoke test, and marks engine ready", async () => {
    const provisioner = new AmetesxModelProvisioner();
    const progressHistory: string[] = [];

    const result = await provisioner.startProvisioning({
      modelId: "qwen2.5-coder-1.5b-instruct-q4_k_m",
      freeDiskSpaceBytes: 20 * 1024 * 1024 * 1024,
      onProgress: (p) => progressHistory.push(p.state),
      mockSmokeTestResult: { success: true },
    });

    expect(result.state).toBe("READY");
    expect(result.smokeTestPassed).toBe(true);
    expect(result.bytesDownloaded).toBe(result.totalBytes);
    expect(result.progressPercent).toBe(100);

    // Verified sequence: DOWNLOADING -> VERIFYING_CHECKSUM -> RUNNING_SMOKE_TEST -> READY
    expect(progressHistory).toContain("DOWNLOADING");
    expect(progressHistory).toContain("VERIFYING_CHECKSUM");
    expect(progressHistory).toContain("RUNNING_SMOKE_TEST");
    expect(progressHistory).toContain("READY");
  });

  it("fails closed and reports error when smoke test fails", async () => {
    const provisioner = new AmetesxModelProvisioner();

    await expect(
      provisioner.startProvisioning({
        modelId: "qwen2.5-coder-1.5b-instruct-q4_k_m",
        freeDiskSpaceBytes: 20 * 1024 * 1024 * 1024,
        mockSmokeTestResult: { success: false, error: "Runtime exit code 1: CUDA out of memory" },
      }),
    ).rejects.toThrow("Runtime exit code 1: CUDA out of memory");

    expect(provisioner.getStatus()?.state).toBe("ERROR");
    expect(provisioner.getStatus()?.smokeTestPassed).toBe(false);
  });

  it("supports user cancellation during download", async () => {
    const provisioner = new AmetesxModelProvisioner();
    const promise = provisioner.startProvisioning({
      modelId: "qwen2.5-coder-1.5b-instruct-q4_k_m",
      freeDiskSpaceBytes: 20 * 1024 * 1024 * 1024,
      mockDownloadDelayMs: 20,
    });

    // Cancel while downloading
    provisioner.cancel();
    const final = await promise;
    expect(final.state).toBe("CANCELLED");
    expect(final.errorMessage).toContain("cancelled by user");
  });

  it("rejects provisioning when disk space is insufficient", async () => {
    const provisioner = new AmetesxModelProvisioner();
    await expect(
      provisioner.startProvisioning({
        modelId: "qwen2.5-coder-7b-instruct-q4_k_m",
        freeDiskSpaceBytes: 1 * 1024 * 1024 * 1024, // only 1 GB free for a 4.68 GB model
      }),
    ).rejects.toThrow(/Insufficient disk space/);
  });
});

describe("Ametesx Resource Guard - Lag Prevention & System Protection", () => {
  it("prevents loading models that exceed RAM or VRAM allocation budgets", () => {
    const budget = evaluateHardwareProfile({
      os: "win32",
      arch: "x64",
      cpuModel: "Intel i5",
      cpuCores: 4,
      totalRamGb: 8,
      availableRamGb: 3.5,
      gpuVendor: "INTEL",
      gpuModel: "UHD Graphics",
      vramGb: 0,
      freeDiskSpaceGb: 30,
      hasCuda: false,
      hasMetal: false,
      hasDirectMl: true,
    });

    const guard = new AmetesxResourceGuard(budget, {
      os: "win32",
      arch: "x64",
      cpuModel: "Intel i5",
      cpuCores: 4,
      totalRamGb: 8,
      availableRamGb: 3.5,
      gpuVendor: "INTEL",
      gpuModel: "UHD Graphics",
      vramGb: 0,
      freeDiskSpaceGb: 30,
      hasCuda: false,
      hasMetal: false,
      hasDirectMl: true,
    });

    // 1.5B model requires 2.0 GB RAM -> fits in budget
    const liteModel = getModelById("qwen2.5-coder-1.5b-instruct-q4_k_m")!;
    expect(guard.canSafelyLoadModel(liteModel).allowed).toBe(true);

    // 14B model requires 14.0 GB RAM -> exceeds 8GB total RAM budget!
    const heavyModel = getModelById("qwen2.5-coder-14b-instruct-q4_k_m")!;
    const heavyCheck = guard.canSafelyLoadModel(heavyModel);
    expect(heavyCheck.allowed).toBe(false);
    expect(heavyCheck.reason).toContain("exceeds the safe model budget");
    guard.dispose();
  });

  it("enforces strict concurrency bounds and releases slot upon completion", async () => {
    const budget = evaluateHardwareProfile({
      os: "win32",
      arch: "x64",
      cpuModel: "Intel i7",
      cpuCores: 8,
      totalRamGb: 16,
      availableRamGb: 8,
      gpuVendor: "AMD",
      gpuModel: "Radeon",
      vramGb: 4,
      freeDiskSpaceGb: 50,
      hasCuda: false,
      hasMetal: false,
      hasDirectMl: true,
    });

    const guard = new AmetesxResourceGuard(budget, {
      os: "win32",
      arch: "x64",
      cpuModel: "Intel i7",
      cpuCores: 8,
      totalRamGb: 16,
      availableRamGb: 8,
      gpuVendor: "AMD",
      gpuModel: "Radeon",
      vramGb: 4,
      freeDiskSpaceGb: 50,
      hasCuda: false,
      hasMetal: false,
      hasDirectMl: true,
    });

    expect(budget.maxConcurrency).toBe(1);

    const release1 = await guard.acquireInferenceSlot(1000);
    expect(guard.getActiveJobCount()).toBe(1);

    // Release slot
    release1();
    expect(guard.getActiveJobCount()).toBe(0);
    guard.dispose();
  });

  it("recovers from memory pressure by reducing context window and suggesting fallback model", () => {
    const budget = evaluateHardwareProfile({
      os: "win32",
      arch: "x64",
      cpuModel: "Ryzen 9",
      cpuCores: 16,
      totalRamGb: 32,
      availableRamGb: 20,
      gpuVendor: "NVIDIA",
      gpuModel: "RTX 4080",
      vramGb: 16,
      freeDiskSpaceGb: 200,
      hasCuda: true,
      hasMetal: false,
      hasDirectMl: true,
    });

    const guard = new AmetesxResourceGuard(budget, {
      os: "win32",
      arch: "x64",
      cpuModel: "Ryzen 9",
      cpuCores: 16,
      totalRamGb: 32,
      availableRamGb: 20,
      gpuVendor: "NVIDIA",
      gpuModel: "RTX 4080",
      vramGb: 16,
      freeDiskSpaceGb: 200,
      hasCuda: true,
      hasMetal: false,
      hasDirectMl: true,
    });

    const recovery = guard.handleMemoryPressureRecovery(16384);
    expect(recovery.recoveredContextTokens).toBe(8192); // Halved context
    expect(recovery.recommendedFallbackModelId).toBe("qwen2.5-coder-7b-instruct-q4_k_m");
    expect(recovery.actionTaken).toContain("Context window reduced");
    guard.dispose();
  });
});

describe("Ametesx Offline & Privacy Guarantees", () => {
  it("blocks outbound non-loopback network calls and telemetry in local-only mode", () => {
    const offlineGuard = new AmetesxOfflineGuard();
    offlineGuard.setLocalOnly(true);

    expect(offlineGuard.isLocalOnly()).toBe(true);

    // Loopback is allowed
    expect(offlineGuard.shouldBlockOutboundCall("http://127.0.0.1:49382/chat")).toBe(false);
    expect(offlineGuard.shouldBlockOutboundCall("http://localhost:11434/api/generate")).toBe(false);

    // External cloud URLs are blocked
    expect(offlineGuard.shouldBlockOutboundCall("https://api.cloudflare.com/client/v4/accounts")).toBe(true);
    expect(offlineGuard.shouldBlockOutboundCall("https://generativelanguage.googleapis.com/v1beta")).toBe(true);
    expect(offlineGuard.shouldBlockOutboundCall("https://telemetry.example.com/events")).toBe(true);
  });

  it("throws clear error when local model is requested but unavailable in local-only mode", () => {
    const offlineGuard = new AmetesxOfflineGuard();
    offlineGuard.setLocalOnly(true);

    expect(() => {
      offlineGuard.assertLocalInferencePermitted(false); // local model not ready
    }).toThrow(/Local-Only Mode is active, but no verified local model is loaded/);

    // When ready, does not throw
    expect(() => {
      offlineGuard.assertLocalInferencePermitted(true);
    }).not.toThrow();
  });
});

describe("Ametesx Game Development Agent Workflow", () => {
  const specs: SystemHardwareSpecs = {
    os: "win32",
    arch: "x64",
    cpuModel: "Intel Core i7",
    cpuCores: 8,
    totalRamGb: 16,
    availableRamGb: 10,
    gpuVendor: "NVIDIA",
    gpuModel: "RTX 3060",
    vramGb: 6,
    freeDiskSpaceGb: 100,
    hasCuda: true,
    hasMetal: false,
    hasDirectMl: true,
  };

  it("recommends appropriate game engine based on hardware tier and concept style", () => {
    // Lite profile gets 2D Canvas even if requesting 3D
    const liteAgent = new AmetesxGameAgent(specs, "LITE", {
      hasNode: true,
      hasPython: false,
      hasGodotCli: false,
      hasCppCompiler: false,
    });
    const liteRec = liteAgent.recommendEngine({
      genre: "platformer",
      style: "3d",
      desiredScope: "small",
    });
    expect(liteRec.engine).toBe("html5-canvas");
    expect(liteRec.limitations.length).toBeGreaterThan(0);

    // Standard profile with Three.js
    const standardAgent = new AmetesxGameAgent(specs, "STANDARD", {
      hasNode: true,
      hasPython: false,
      hasGodotCli: false,
      hasCppCompiler: false,
    });
    const stdRec = standardAgent.recommendEngine({
      genre: "racing",
      style: "3d",
      desiredScope: "medium",
    });
    expect(stdRec.engine).toBe("threejs");

    // Standard profile with Godot CLI installed
    const godotAgent = new AmetesxGameAgent(specs, "STANDARD", {
      hasNode: true,
      hasPython: false,
      hasGodotCli: true,
      hasCppCompiler: false,
    });
    const godotRec = godotAgent.recommendEngine({
      genre: "rpg",
      style: "3d",
      desiredScope: "medium",
    });
    expect(godotRec.engine).toBe("godot");
  });

  it("generates milestone plan with architecture, gameplay, scenes, audio, and builds", () => {
    const agent = new AmetesxGameAgent(specs, "STANDARD", {
      hasNode: true,
      hasPython: false,
      hasGodotCli: false,
      hasCppCompiler: false,
    });

    const plan = agent.createProjectPlan({
      title: "Solar Drift",
      genre: "Sci-Fi Racer",
      visualStyle: "Cyberpunk Neon",
      style: "3d",
      desiredScope: "medium",
    });

    expect(plan.title).toBe("Solar Drift");
    expect(plan.recommendedEngine).toBe("threejs");
    expect(plan.milestones.length).toBe(5);
    expect(plan.milestones.map((m) => m.id)).toEqual([
      "m1-scaffold",
      "m2-core-mechanics",
      "m3-scenes-assets",
      "m4-audio-ui",
      "m5-build-validation",
    ]);
  });

  it("inspects build errors, executes self-correction, and validates resulting artifact", () => {
    const agent = new AmetesxGameAgent(specs, "STANDARD", {
      hasNode: true,
      hasPython: false,
      hasGodotCli: false,
      hasCppCompiler: false,
    });

    const files = {
      "index.html": "<!DOCTYPE html><html><body><canvas id='c'></canvas></body></html>",
      "src/main.js": "console.log('game start');",
    };

    const buildResult = agent.executeBuildAndRepair(
      "threejs",
      files,
      ["Cannot find module 'three/addons/controls/OrbitControls.js'"],
    );

    expect(buildResult.success).toBe(true);
    expect(buildResult.correctionsAttempted).toBe(1);
    expect(buildResult.artifactPath).toBe("dist/game-bundle.zip");
    expect(buildResult.buildLogs.some((l) => l.includes("patching"))).toBe(true);
  });
});

describe("Ametesx Project Exporter & Real Artifact Validation", () => {
  it("packages genuine ZIP archive and verifies PK magic header", async () => {
    const exporter = new AmetesxProjectExporter();
    const files = {
      "README.md": "# Solar Drift\nA 3D racing game.",
      "src/game.js": "export function start() {}",
    };

    const result = await exporter.exportProject({
      projectId: "proj-123",
      projectName: "SolarDrift",
      format: "zip",
      files,
    });

    expect(result.success).toBe(true);
    expect(result.format).toBe("zip");
    expect(result.artifactPath).toBe("SolarDrift.zip");
    expect(result.artifactSizeBytes).toBeGreaterThan(100);
    expect(result.validationStatus).toBe("VALID");

    // Test raw ZIP bytes
    const rawZip = createInMemoryZip(files);
    expect(validateZipArchive(rawZip)).toBe(true);
  });

  it("validates genuine 3D GLB binary format and rejects non-GLB files", () => {
    // Construct real GLB buffer: 12-byte header + 8-byte chunk0 header + JSON payload
    const jsonStr = JSON.stringify({ asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: "Mesh" }] });
    const jsonBytes = new TextEncoder().encode(jsonStr);
    const totalLength = 12 + 8 + jsonBytes.length;
    const validGlb = new Uint8Array(totalLength);
    const view = new DataView(validGlb.buffer);
    view.setUint32(0, 0x46546c67, true); // 'glTF'
    view.setUint32(4, 2, true);          // version 2
    view.setUint32(8, totalLength, true); // total length
    view.setUint32(12, jsonBytes.length, true); // chunk length
    view.setUint32(16, 0x4e4f534a, true); // 'JSON'
    validGlb.set(jsonBytes, 20);

    expect(validateGlbBinary(validGlb)).toBe(true);

    const invalidGlb = new Uint8Array([0x00, 0x11, 0x22, 0x33, 0x44, 0x55]);
    expect(validateGlbBinary(invalidGlb)).toBe(false);
  });

  it("validates genuine WAV audio format and rejects non-WAV files", () => {
    // Construct complete WAV buffer with 'RIFF', 'fmt ' chunk, and 'data' chunk
    const totalSize = 44 + 4; // header + 4 bytes sample data
    const wavBytes = new Uint8Array(totalSize);
    const view = new DataView(wavBytes.buffer);
    // 'RIFF'
    view.setUint32(0, 0x46464952, true);
    view.setUint32(4, totalSize - 8, true);
    // 'WAVE'
    view.setUint32(8, 0x45564157, true);
    // 'fmt ' chunk
    view.setUint32(12, 0x20746d66, true);
    view.setUint32(16, 16, true); // chunk size
    view.setUint16(20, 1, true);  // PCM format
    view.setUint16(22, 1, true);  // 1 channel (mono)
    view.setUint32(24, 16000, true); // sample rate 16kHz
    view.setUint32(28, 32000, true); // byte rate
    view.setUint16(32, 2, true);     // block align
    view.setUint16(34, 16, true);    // bits per sample
    // 'data' chunk
    view.setUint32(36, 0x61746164, true);
    view.setUint32(40, 4, true); // 4 bytes of audio samples
    wavBytes[44] = 0x00; wavBytes[45] = 0x10; wavBytes[46] = 0x00; wavBytes[47] = 0x20;

    expect(validateWavAudio(wavBytes)).toBe(true);

    const invalidAudio = new Uint8Array([0x12, 0x34, 0x56, 0x78]);
    expect(validateWavAudio(invalidAudio)).toBe(false);
  });

  it("validates Windows PE executable header (MZ) and reports missing compiler when absent", async () => {
    const exporter = new AmetesxProjectExporter();
    const files = { "main.c": "int main() { return 0; }" };

    // When compiler missing
    const failedResult = await exporter.exportProject(
      {
        projectId: "proj-1",
        projectName: "NativeGame",
        format: "windows-exe",
        files,
      },
      { hasWindowsCompiler: false },
    );

    expect(failedResult.success).toBe(false);
    expect(failedResult.validationStatus).toBe("COMPILATION_FAILED");
    expect(failedResult.missingSdkMessage).toContain("Windows native compilation tools");

    // When compiler present
    const successResult = await exporter.exportProject(
      {
        projectId: "proj-1",
        projectName: "NativeGame",
        format: "windows-exe",
        files,
      },
      { hasWindowsCompiler: true },
    );

    expect(successResult.success).toBe(true);
    expect(successResult.validationStatus).toBe("VALID");
    expect(successResult.artifactPath).toBe("NativeGame.exe");

    // Valid PE binary test fixture
    const validExe = new Uint8Array(512);
    const peView = new DataView(validExe.buffer);
    peView.setUint16(0, 0x5a4d, true); // 'MZ'
    peView.setUint32(0x3c, 0x80, true); // e_lfanew
    peView.setUint32(0x80, 0x00004550, true); // 'PE\0\0'
    peView.setUint16(0x84, 0x8664, true); // AMD64
    expect(validateWindowsExecutable(validExe)).toBe(true);
  });
});

