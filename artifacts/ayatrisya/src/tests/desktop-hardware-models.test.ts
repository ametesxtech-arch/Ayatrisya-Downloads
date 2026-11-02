import { describe, expect, it } from "vitest";
import {
  AYATRISYA_MODEL_CATALOG,
  getModelsByCategory,
  getModelsForTier,
  getModelById,
  getDefaultChatModelForHardware,
} from "../desktop/models/catalog";
import { evaluateHardwareProfile } from "../desktop/hardware/profiler";
import type { SystemHardwareSpecs } from "../desktop/hardware/types";

describe("Ayatrisya Desktop: Adaptive Hardware & Model Catalog", () => {
  describe("Model Catalog & Licenses", () => {
    it("provides license-verified CPU-compatible chat models", () => {
      const qwen15 = getModelById("qwen2.5-1.5b-instruct-q4_k_m");
      expect(qwen15).toBeDefined();
      expect(qwen15?.category).toBe("chat");
      expect(qwen15?.license).toBe("Apache-2.0");
      expect(qwen15?.requirements.minRamGb).toBeLessThanOrEqual(3.0);
      expect(qwen15?.downloadSource).toContain("huggingface.co/Qwen");
      expect(qwen15?.expectedSha256).toMatch(/^[a-f0-9]{64}$/);
    });

    it("verifies specialist categories are distinctly separated from chat models", () => {
      const codingModels = getModelsByCategory("coding");
      expect(codingModels.length).toBeGreaterThan(0);
      expect(codingModels.every((m) => m.category === "coding" && m.isSpecialist)).toBe(true);

      const reasoningModels = getModelsByCategory("reasoning");
      expect(reasoningModels.length).toBeGreaterThan(0);
      expect(reasoningModels.some((m) => m.id === "deepseek-r1-distill-qwen-1.5b-q4_k_m")).toBe(true);

      const mesh3d = getModelById("triposr-mesh-gen-fp16");
      expect(mesh3d?.category).toBe("3d-mesh");
      expect(mesh3d?.isSpecialist).toBe(true);
    });

    it("provides deterministic default chat model recommendations based on RAM", () => {
      expect(getDefaultChatModelForHardware(16).id).toBe("qwen2.5-7b-instruct-q4_k_m");
      expect(getDefaultChatModelForHardware(8).id).toBe("qwen2.5-3b-instruct-q4_k_m");
      expect(getDefaultChatModelForHardware(3).id).toBe("qwen2.5-1.5b-instruct-q4_k_m");
    });
  });

  describe("Deterministic Hardware Evaluation & Fallback Hierarchy", () => {
    it("evaluates a standard 8 GB RAM laptop CPU and recommends a balanced model with bounded threads", () => {
      const specs: SystemHardwareSpecs = {
        os: "win32",
        arch: "x64",
        cpuModel: "12th Gen Intel Core i5-1240P",
        cpuCores: 8,
        totalRamGb: 8.0,
        availableRamGb: 4.8,
        gpuVendor: "INTEL",
        gpuModel: "Intel Iris Xe Graphics",
        vramGb: 0,
        freeDiskSpaceGb: 45.0,
        hasCuda: false,
        hasMetal: false,
        hasDirectMl: true,
      };

      const result = evaluateHardwareProfile(specs);
      expect(result.recommendedTier).toBe("LITE");
      expect(result.recommendedChatModelId).toBe("qwen2.5-3b-instruct-q4_k_m");
      expect(result.fallbackHierarchy).toEqual([
        "qwen2.5-3b-instruct-q4_k_m",
        "qwen2.5-1.5b-instruct-q4_k_m",
      ]);
      expect(result.boundedCpuThreads).toBe(7); // 8 - 1 reserved
      expect(result.canSafelyRunLocalModel).toBe(true);
      expect(result.reservedRamGb).toBe(2.0); // 2.0 GB reserved for OS and UI
    });

    it("evaluates a low-RAM PC (4 GB total, 1.5 GB available) and warns about insufficient memory", () => {
      const specs: SystemHardwareSpecs = {
        os: "win32",
        arch: "x64",
        cpuModel: "Intel Celeron N4020",
        cpuCores: 2,
        totalRamGb: 4.0,
        availableRamGb: 1.5,
        gpuVendor: "INTEL",
        gpuModel: "Intel UHD Graphics 600",
        vramGb: 0,
        freeDiskSpaceGb: 20.0,
        hasCuda: false,
        hasMetal: false,
        hasDirectMl: true,
      };

      const result = evaluateHardwareProfile(specs);
      expect(result.canSafelyRunLocalModel).toBe(false);
      expect(result.remediationAdvice).toContain("below the minimum safety threshold");
      expect(result.warningNotes.some((w) => w.includes("Insufficient available RAM"))).toBe(true);
      expect(result.boundedCpuThreads).toBe(1);
    });

    it("evaluates a high-end workstation with NVIDIA RTX GPU", () => {
      const specs: SystemHardwareSpecs = {
        os: "win32",
        arch: "x64",
        cpuModel: "AMD Ryzen 9 7950X",
        cpuCores: 16,
        totalRamGb: 32.0,
        availableRamGb: 22.0,
        gpuVendor: "NVIDIA",
        gpuModel: "NVIDIA GeForce RTX 4080",
        vramGb: 16.0,
        freeDiskSpaceGb: 250.0,
        hasCuda: true,
        hasMetal: false,
        hasDirectMl: true,
      };

      const result = evaluateHardwareProfile(specs);
      expect(result.recommendedTier).toBe("MAX");
      expect(result.recommendedChatModelId).toBe("qwen2.5-7b-instruct-q4_k_m");
      expect(result.maxContextTokens).toBe(16384);
      expect(result.boundedCpuThreads).toBe(8); // capped at 8 to prevent thread contention
      expect(result.fallbackHierarchy).toContain("qwen2.5-7b-instruct-q4_k_m");
      expect(result.fallbackHierarchy).toContain("qwen2.5-3b-instruct-q4_k_m");
      expect(result.fallbackHierarchy).toContain("qwen2.5-1.5b-instruct-q4_k_m");
    });

    it("triggers critical disk space warning when disk space is below 8 GB", () => {
      const specs: SystemHardwareSpecs = {
        os: "win32",
        arch: "x64",
        cpuModel: "Intel Core i7-11800H",
        cpuCores: 8,
        totalRamGb: 16.0,
        availableRamGb: 10.0,
        gpuVendor: "INTEL",
        gpuModel: "Intel UHD",
        vramGb: 0,
        freeDiskSpaceGb: 5.2,
        hasCuda: false,
        hasMetal: false,
        hasDirectMl: true,
      };

      const result = evaluateHardwareProfile(specs);
      expect(result.warningNotes.some((w) => w.includes("Critically low disk space"))).toBe(true);
    });
  });
});
