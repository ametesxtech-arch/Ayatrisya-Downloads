export * from "./hardware/types";
export * from "./hardware/profiler";

// Compatibility alias for ResourceBudget
import type { HardwareRecommendation } from "./hardware/types";
export type ResourceBudget = HardwareRecommendation & {
  tierScore: number;
  maxConcurrency: number;
  eligibleModelIds: string[];
};
