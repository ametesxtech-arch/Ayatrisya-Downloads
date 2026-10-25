export type HardwareProfileTier = "LITE" | "STANDARD" | "MAX";

export type GpuVendor = "NVIDIA" | "AMD" | "INTEL" | "APPLE" | "UNKNOWN";

export interface SystemHardwareSpecs {
  os: "win32" | "darwin" | "linux";
  arch: string;
  cpuModel: string;
  cpuCores: number;
  totalRamGb: number;
  availableRamGb: number;
  gpuVendor: GpuVendor;
  gpuModel: string;
  vramGb: number;
  freeDiskSpaceGb: number;
  hasCuda: boolean;
  hasMetal: boolean;
  hasDirectMl: boolean;
}

export interface ResourceBudget {
  recommendedTier: HardwareProfileTier;
  tierScore: number;
  reservedRamGb: number;
  maxModelRamGb: number;
  maxModelVramGb: number;
  maxContextTokens: number;
  maxConcurrency: number;
  eligibleModelIds: string[];
  warningNotes: string[];
}

/**
 * Conservative resource budget evaluation according to physical computer specifications.
 * Ensures OS and UI have guaranteed reserved memory, models do not cause out-of-memory thrashing,
 * and context lengths are bounded to prevent system freezes.
 */
export function evaluateHardwareProfile(specs: SystemHardwareSpecs): ResourceBudget {
  const warnings: string[] = [];

  // 1. Detect disk pressure
  if (specs.freeDiskSpaceGb < 10) {
    warnings.push("Low disk space: less than 10 GB free. Model downloads may fail.");
  }

  // 2. Compute RAM reservation: minimum 2 GB for OS/UI, scaling up on large systems
  const reservedRamGb = specs.totalRamGb <= 8 ? 2.0 : specs.totalRamGb <= 16 ? 3.0 : 4.0;
  const maxModelRamGb = Math.max(1.0, Math.min(specs.totalRamGb - reservedRamGb, specs.totalRamGb * 0.65));

  // 3. Compute VRAM budget: max 75% of dedicated VRAM if present
  const maxModelVramGb = specs.vramGb > 0 ? Math.min(specs.vramGb * 0.75, specs.vramGb - 0.5) : 0;

  // 4. Tier assessment:
  // - MAX: >= 16 GB RAM AND (>= 8 GB VRAM with CUDA or Metal)
  // - STANDARD: >= 8 GB RAM AND (>= 4 GB VRAM OR >= 16 GB System RAM with 6+ CPU cores)
  // - LITE: Everything else (e.g. 4-8 GB RAM, integrated graphics)
  let recommendedTier: HardwareProfileTier = "LITE";
  let maxContextTokens = 2048;
  let maxConcurrency = 1;
  let tierScore = 1;

  const hasHighEndGpu = (specs.hasCuda || specs.hasMetal) && specs.vramGb >= 8;
  const hasMidRangeGpu = specs.vramGb >= 4;

  if (specs.totalRamGb >= 16 && hasHighEndGpu) {
    recommendedTier = "MAX";
    maxContextTokens = 16384;
    maxConcurrency = specs.vramGb >= 16 ? 2 : 1;
    tierScore = 3;
  } else if (
    (specs.totalRamGb >= 12 && hasMidRangeGpu) ||
    (specs.totalRamGb >= 16 && specs.cpuCores >= 6) ||
    (specs.totalRamGb >= 8 && specs.vramGb >= 6)
  ) {
    recommendedTier = "STANDARD";
    maxContextTokens = 8192;
    maxConcurrency = 1;
    tierScore = 2;
  } else {
    recommendedTier = "LITE";
    maxContextTokens = 4096;
    maxConcurrency = 1;
    tierScore = 1;
    if (specs.totalRamGb < 8) {
      warnings.push("System RAM is under 8 GB. Context length and model weights will be strictly constrained.");
    }
    if (specs.vramGb < 2) {
      warnings.push("No dedicated GPU with >= 2 GB VRAM detected. Running on CPU / integrated graphics.");
    }
  }

  // 5. Eligible models based on tier
  const eligibleModelIds: string[] = [];
  if (recommendedTier === "LITE") {
    eligibleModelIds.push("qwen2.5-coder-1.5b-instruct-q4_k_m", "llama-3.2-1b-instruct-q4_k_m");
  } else if (recommendedTier === "STANDARD") {
    eligibleModelIds.push(
      "qwen2.5-coder-7b-instruct-q4_k_m",
      "llama-3.1-8b-instruct-q4_k_m",
      "qwen2.5-coder-1.5b-instruct-q4_k_m",
    );
  } else {
    // MAX tier
    eligibleModelIds.push(
      "nvidia-nemotron-mini-4b-instruct-q4_k_m",
      "qwen2.5-coder-14b-instruct-q4_k_m",
      "qwen2.5-coder-7b-instruct-q4_k_m",
    );
    if (specs.vramGb >= 24 || specs.totalRamGb >= 32) {
      eligibleModelIds.push("qwen2.5-coder-32b-instruct-q4_k_m");
    }
  }

  return {
    recommendedTier,
    tierScore,
    reservedRamGb,
    maxModelRamGb: Number(maxModelRamGb.toFixed(1)),
    maxModelVramGb: Number(maxModelVramGb.toFixed(1)),
    maxContextTokens,
    maxConcurrency,
    eligibleModelIds,
    warningNotes: warnings,
  };
}
