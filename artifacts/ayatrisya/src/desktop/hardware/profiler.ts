import type { SystemHardwareSpecs, HardwareRecommendation, HardwareProfileTier } from "./types";
import { AYATRISYA_MODEL_CATALOG, getModelById } from "../models/catalog";

/**
 * Deterministic hardware evaluation for Ayatrisya Desktop.
 * Accurately analyzes detected CPU, memory, and disk constraints,
 * preventing system freezes, thermal overload, and out-of-memory thrashing.
 */
export function evaluateHardwareProfile(specs: SystemHardwareSpecs): HardwareRecommendation {
  const warnings: string[] = [];

  // 1. Thread bounding: reserve at least 1 core for OS/UI, cap at 8 to prevent thread contention
  const boundedCpuThreads = Math.max(1, Math.min(specs.cpuCores - 1, 8));

  // 2. RAM Reservation: OS and desktop web app need guaranteed head-room
  const reservedRamGb = specs.totalRamGb <= 8 ? 2.0 : specs.totalRamGb <= 16 ? 3.0 : 4.0;
  const rawModelRam = specs.totalRamGb - reservedRamGb;
  const maxModelRamGb = Math.max(0.5, Number((specs.totalRamGb <= 8 ? Math.min(5.5, rawModelRam) : rawModelRam).toFixed(2)));

  // 3. VRAM budget (if discrete or unified GPU exists)
  const maxModelVramGb = specs.vramGb > 0 ? Number(Math.max(0, specs.vramGb * 0.8 - 0.5).toFixed(2)) : 0;

  // 4. Disk space pre-check
  if (specs.freeDiskSpaceGb < 8) {
    warnings.push(`Critically low disk space: only ${specs.freeDiskSpaceGb.toFixed(1)} GB free. Downloads will be blocked until space is freed.`);
    warnings.push("Low disk space (< 10 GB). Model downloads require at least 10 GB free space.");
  } else if (specs.freeDiskSpaceGb < 10) {
    warnings.push("Low disk space (< 10 GB). Model downloads require at least 10 GB free space.");
  } else if (specs.freeDiskSpaceGb < 15) {
    warnings.push(`Low disk space: ${specs.freeDiskSpaceGb.toFixed(1)} GB free. Sufficient for smaller models only.`);
  }

  // 5. Tier assignment
  let recommendedTier: HardwareProfileTier = "LITE";
  let maxContextTokens = 4096;

  const hasWorkstationGpu = (specs.hasCuda || specs.hasMetal) && specs.vramGb >= 8;
  const hasWorkstationRam = specs.totalRamGb >= 24;

  if (hasWorkstationGpu || (hasWorkstationRam && specs.cpuCores >= 8)) {
    recommendedTier = "MAX";
    maxContextTokens = 16384;
  } else if (specs.totalRamGb >= 12 || (specs.totalRamGb >= 8 && specs.vramGb >= 4)) {
    recommendedTier = "STANDARD";
    maxContextTokens = 8192;
  } else {
    recommendedTier = "LITE";
    maxContextTokens = 4096;
  }

  if (specs.totalRamGb < 8) {
    warnings.push("System RAM is under 8 GB. Only ultra-light models will run without paging.");
  }
  if (specs.vramGb < 2) {
    warnings.push("Running entirely on CPU multi-threading. Dedicated GPU acceleration is not active.");
  }

  const maxConcurrency = (recommendedTier === "MAX" && specs.vramGb >= 8) ? 2 : 1;
  const eligibleModelIds: string[] = [];
  if (recommendedTier === "MAX") {
    eligibleModelIds.push(
      "nvidia-nemotron-mini-4b-instruct-q4_k_m",
      "qwen2.5-coder-32b-instruct-q4_k_m",
      "qwen2.5-coder-7b-instruct-q4_k_m",
      "qwen2.5-coder-1.5b-instruct-q4_k_m"
    );
  } else if (recommendedTier === "STANDARD") {
    eligibleModelIds.push(
      "qwen2.5-coder-7b-instruct-q4_k_m",
      "qwen2.5-coder-1.5b-instruct-q4_k_m"
    );
  } else {
    eligibleModelIds.push(
      "qwen2.5-coder-1.5b-instruct-q4_k_m",
      "llama-3.2-1b-instruct-q4_k_m"
    );
  }

  // 6. Deterministic Fallback Hierarchy & Model Recommendation
  // Hierarchy:
  // 1. Qwen 2.5 7B (if maxModelRamGb >= 7.5 GB)
  // 2. Qwen 2.5 3B (if maxModelRamGb >= 4.5 GB)
  // 3. Qwen 2.5 1.5B (if maxModelRamGb >= 2.2 GB)
  const fallbackHierarchy: string[] = [];
  let recommendedChatModelId = "qwen2.5-1.5b-instruct-q4_k_m";
  let canSafelyRunLocalModel = true;
  let remediationAdvice: string | undefined = undefined;

  if (maxModelRamGb >= 7.5 && specs.availableRamGb >= 6.0) {
    recommendedChatModelId = "qwen2.5-7b-instruct-q4_k_m";
    fallbackHierarchy.push(
      "qwen2.5-7b-instruct-q4_k_m",
      "qwen2.5-3b-instruct-q4_k_m",
      "qwen2.5-1.5b-instruct-q4_k_m",
    );
  } else if (maxModelRamGb >= 4.5 && specs.availableRamGb >= 3.5) {
    recommendedChatModelId = "qwen2.5-3b-instruct-q4_k_m";
    fallbackHierarchy.push(
      "qwen2.5-3b-instruct-q4_k_m",
      "qwen2.5-1.5b-instruct-q4_k_m",
    );
  } else if (maxModelRamGb >= 2.0 && specs.availableRamGb >= 1.8) {
    recommendedChatModelId = "qwen2.5-1.5b-instruct-q4_k_m";
    fallbackHierarchy.push("qwen2.5-1.5b-instruct-q4_k_m");
  } else {
    // Insufficient memory to safely run even 1.5B model
    canSafelyRunLocalModel = false;
    recommendedChatModelId = "qwen2.5-1.5b-instruct-q4_k_m";
    remediationAdvice = `Available system memory (${specs.availableRamGb.toFixed(1)} GB) is below the minimum safety threshold (2.0 GB). Close browser tabs or other memory-intensive applications, or use Ayatrisya Cloud / Custom Remote connection.`;
    warnings.push("Insufficient available RAM to safely launch local inference without risking out-of-memory errors.");
  }

  const tierScore = recommendedTier === "MAX" ? 3 : recommendedTier === "STANDARD" ? 2 : 1;

  return {
    recommendedTier,
    tierScore,
    recommendedChatModelId,
    fallbackHierarchy,
    reservedRamGb,
    maxModelRamGb,
    maxModelVramGb,
    maxContextTokens,
    boundedCpuThreads,
    maxConcurrency,
    eligibleModelIds,
    canSafelyRunLocalModel,
    warningNotes: warnings,
    remediationAdvice,
  };
}
