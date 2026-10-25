import type { ResourceBudget, SystemHardwareSpecs } from "./hardware";
import type { RegisteredModel } from "./model-registry";

export interface InferenceJobMetrics {
  jobId: string;
  modelId: string;
  durationMs: number;
  tokensGenerated: number;
  tokensPerSec: number;
  peakMemoryMb: number;
  wasCancelled: boolean;
  wasOomRecovered: boolean;
}

export class AmetesxResourceGuard {
  private activeJobs = 0;
  private queuedJobs = 0;
  private readonly maxQueueDepth = 4;
  private loadedModel: RegisteredModel | null = null;
  private lastActiveTimestamp = Date.now();
  private idleUnloadTimer: NodeJS.Timeout | null = null;
  private readonly idleTimeoutMs = 10 * 60 * 1000; // 10 minutes

  constructor(
    private readonly budget: ResourceBudget,
    private readonly specs: SystemHardwareSpecs,
    private readonly onUnloadModel?: (modelId: string) => void,
  ) {}

  public getActiveJobCount(): number {
    return this.activeJobs;
  }

  public getLoadedModel(): RegisteredModel | null {
    return this.loadedModel;
  }

  /**
   * Validate whether a model can be safely loaded without exceeding memory reserves.
   */
  public canSafelyLoadModel(model: RegisteredModel): { allowed: boolean; reason?: string } {
    const requiredRam = model.minRamGb;
    const requiredVram = model.minVramGb;

    // Check RAM limit against budget
    if (requiredRam > this.budget.maxModelRamGb) {
      return {
        allowed: false,
        reason: `Model requires ${requiredRam} GB RAM, which exceeds the safe model budget of ${this.budget.maxModelRamGb} GB (reserving ${this.budget.reservedRamGb} GB for OS/UI).`,
      };
    }

    // Check VRAM limit if model requires dedicated VRAM
    if (requiredVram > 0 && this.budget.maxModelVramGb > 0 && requiredVram > this.budget.maxModelVramGb) {
      return {
        allowed: false,
        reason: `Model requires ${requiredVram} GB VRAM, exceeding the safe VRAM allocation of ${this.budget.maxModelVramGb} GB.`,
      };
    }

    // Protect against loading multiple models simultaneously
    if (this.loadedModel && this.loadedModel.id !== model.id) {
      // Must unload previous model to preserve memory
      return {
        allowed: true,
        reason: `Loading ${model.name} will unload previously loaded ${this.loadedModel.name} to protect memory.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Acquire inference slot with concurrency and queue depth guards.
   */
  public async acquireInferenceSlot(timeoutMs = 60_000): Promise<() => void> {
    if (this.activeJobs >= this.budget.maxConcurrency) {
      if (this.queuedJobs >= this.maxQueueDepth) {
        throw new Error("System busy: inference queue is full. Wait for ongoing operations to complete.");
      }
      this.queuedJobs++;
      // Wait for slot with timeout
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.queuedJobs--;
          reject(new Error("Inference slot acquisition timed out under system load."));
        }, timeoutMs);

        const checkInterval = setInterval(() => {
          if (this.activeJobs < this.budget.maxConcurrency) {
            clearInterval(checkInterval);
            clearTimeout(timer);
            this.queuedJobs--;
            resolve();
          }
        }, 50);
      });
    }

    this.activeJobs++;
    this.touchActivity();

    return () => {
      this.activeJobs = Math.max(0, this.activeJobs - 1);
      this.touchActivity();
    };
  }

  /**
   * Track model load and set up idle unload timer.
   */
  public markModelLoaded(model: RegisteredModel): void {
    this.loadedModel = model;
    this.touchActivity();
  }

  public touchActivity(): void {
    this.lastActiveTimestamp = Date.now();
    if (this.idleUnloadTimer) {
      clearTimeout(this.idleUnloadTimer);
    }
    this.idleUnloadTimer = setTimeout(() => {
      this.checkAndUnloadIdle();
    }, this.idleTimeoutMs);
  }

  private checkAndUnloadIdle(): void {
    if (this.activeJobs === 0 && this.loadedModel) {
      const modelId = this.loadedModel.id;
      this.loadedModel = null;
      if (this.onUnloadModel) {
        this.onUnloadModel(modelId);
      }
    }
  }

  /**
   * Out-of-memory or high pressure recovery:
   * Dynamically clamps context window or advises fallback tier.
   */
  public handleMemoryPressureRecovery(
    currentContextTokens: number,
  ): {
    recoveredContextTokens: number;
    recommendedFallbackModelId: string | null;
    actionTaken: string;
  } {
    const recoveredTokens = Math.max(1024, Math.floor(currentContextTokens / 2));
    let fallbackModelId: string | null = null;
    let actionTaken = `Context window reduced from ${currentContextTokens} to ${recoveredTokens} tokens to relieve memory pressure.`;

    if (this.budget.recommendedTier === "MAX") {
      fallbackModelId = "qwen2.5-coder-7b-instruct-q4_k_m";
      actionTaken += " Recommending standard tier model fallback.";
    } else if (this.budget.recommendedTier === "STANDARD") {
      fallbackModelId = "qwen2.5-coder-1.5b-instruct-q4_k_m";
      actionTaken += " Recommending lite tier model fallback.";
    }

    return {
      recoveredContextTokens: recoveredTokens,
      recommendedFallbackModelId: fallbackModelId,
      actionTaken,
    };
  }

  public dispose(): void {
    if (this.idleUnloadTimer) {
      clearTimeout(this.idleUnloadTimer);
      this.idleUnloadTimer = null;
    }
  }
}
