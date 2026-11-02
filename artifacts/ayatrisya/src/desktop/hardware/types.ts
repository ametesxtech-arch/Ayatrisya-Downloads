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
  hasAvx2?: boolean;
}

export interface HardwareRecommendation {
  recommendedTier: HardwareProfileTier;
  tierScore: number;
  recommendedChatModelId: string;
  fallbackHierarchy: string[];
  reservedRamGb: number;
  maxModelRamGb: number;
  maxModelVramGb: number;
  maxContextTokens: number;
  boundedCpuThreads: number;
  maxConcurrency: number;
  eligibleModelIds: string[];
  canSafelyRunLocalModel: boolean;
  warningNotes: string[];
  remediationAdvice?: string;
}
