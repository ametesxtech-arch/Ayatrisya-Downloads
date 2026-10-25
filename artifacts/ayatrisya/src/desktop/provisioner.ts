import { AMETESX_MODEL_REGISTRY, getModelById, type RegisteredModel } from "./model-registry";
import type { SystemHardwareSpecs, HardwareProfileTier } from "./hardware";

export type ProvisioningState =
  | "IDLE"
  | "CONFIRMATION_REQUIRED"
  | "DOWNLOADING"
  | "PAUSED"
  | "VERIFYING_CHECKSUM"
  | "RUNNING_SMOKE_TEST"
  | "READY"
  | "ERROR"
  | "CANCELLED";

export interface ProvisioningProgress {
  modelId: string;
  state: ProvisioningState;
  bytesDownloaded: number;
  totalBytes: number;
  progressPercent: number;
  downloadRateBytesPerSec: number;
  errorMessage: string | null;
  smokeTestPassed: boolean;
  activeRuntime: string | null;
}

export interface ProvisioningOptions {
  modelId: string;
  freeDiskSpaceBytes: number;
  onProgress?: (progress: ProvisioningProgress) => void;
  mockDownloadDelayMs?: number;
  mockSmokeTestResult?: { success: boolean; error?: string };
}

export class AmetesxModelProvisioner {
  private currentProgress: ProvisioningProgress | null = null;
  private isCancelled = false;
  private isPaused = false;
  private activeDownloadController: AbortController | null = null;

  public getStatus(): ProvisioningProgress | null {
    return this.currentProgress;
  }

  /**
   * Plan initial model package provisioning based on user hardware tier.
   * Does NOT start download until explicitly confirmed.
   */
  public prepareInitialPackage(
    tier: HardwareProfileTier,
    specs: SystemHardwareSpecs,
  ): {
    recommendedModel: RegisteredModel;
    requiredDiskBytes: number;
    sufficientDiskSpace: boolean;
    confirmationPrompt: string;
  } {
    // Select default coding/chat model for tier
    const targetModelId =
      tier === "MAX"
        ? "nvidia-nemotron-mini-4b-instruct-q4_k_m"
        : tier === "STANDARD"
          ? "qwen2.5-coder-7b-instruct-q4_k_m"
          : "qwen2.5-coder-1.5b-instruct-q4_k_m";

    const model = getModelById(targetModelId)!;
    const requiredDiskBytes = model.diskSizeBytes;
    const freeBytes = specs.freeDiskSpaceGb * 1024 * 1024 * 1024;
    const sufficientDiskSpace = freeBytes > requiredDiskBytes * 1.5; // 50% buffer

    const confirmationPrompt =
      `Download ${model.name} (${model.diskSizeGb} GB)? ` +
      `This model runs 100% locally on your computer with ${model.license}. ` +
      `Estimated free disk remaining: ${((freeBytes - requiredDiskBytes) / (1024 * 1024 * 1024)).toFixed(1)} GB.`;

    this.currentProgress = {
      modelId: model.id,
      state: "CONFIRMATION_REQUIRED",
      bytesDownloaded: 0,
      totalBytes: model.diskSizeBytes,
      progressPercent: 0,
      downloadRateBytesPerSec: 0,
      errorMessage: null,
      smokeTestPassed: false,
      activeRuntime: null,
    };

    return {
      recommendedModel: model,
      requiredDiskBytes,
      sufficientDiskSpace,
      confirmationPrompt,
    };
  }

  /**
   * Start or resume asynchronous model provisioning.
   */
  public async startProvisioning(options: ProvisioningOptions): Promise<ProvisioningProgress> {
    const model = getModelById(options.modelId);
    if (!model) {
      throw new Error(`Model ${options.modelId} not found in Ametesx registry.`);
    }

    if (options.freeDiskSpaceBytes < model.diskSizeBytes * 1.2) {
      const err = `Insufficient disk space. Model requires ${model.diskSizeGb} GB plus temporary buffer.`;
      this.updateProgress({
        modelId: model.id,
        state: "ERROR",
        bytesDownloaded: 0,
        totalBytes: model.diskSizeBytes,
        progressPercent: 0,
        downloadRateBytesPerSec: 0,
        errorMessage: err,
        smokeTestPassed: false,
        activeRuntime: null,
      }, options.onProgress);
      throw new Error(err);
    }

    this.isCancelled = false;
    this.isPaused = false;
    this.activeDownloadController = new AbortController();

    // 1. Downloading phase
    this.updateProgress({
      modelId: model.id,
      state: "DOWNLOADING",
      bytesDownloaded: 0,
      totalBytes: model.diskSizeBytes,
      progressPercent: 0,
      downloadRateBytesPerSec: 15_000_000, // 15 MB/s simulation
      errorMessage: null,
      smokeTestPassed: false,
      activeRuntime: model.recommendedRuntime,
    }, options.onProgress);

    // Simulate chunked download steps
    const chunks = 5;
    const chunkSize = Math.floor(model.diskSizeBytes / chunks);
    for (let i = 1; i <= chunks; i++) {
      if (this.isCancelled) {
        this.updateProgress({
          ...this.currentProgress!,
          state: "CANCELLED",
          errorMessage: "Provisioning cancelled by user.",
        }, options.onProgress);
        return this.currentProgress!;
      }
      if (this.isPaused) {
        this.updateProgress({
          ...this.currentProgress!,
          state: "PAUSED",
        }, options.onProgress);
        return this.currentProgress!;
      }

      if (options.mockDownloadDelayMs) {
        await new Promise((r) => setTimeout(r, options.mockDownloadDelayMs));
      }

      const downloaded = i === chunks ? model.diskSizeBytes : i * chunkSize;
      this.updateProgress({
        ...this.currentProgress!,
        bytesDownloaded: downloaded,
        progressPercent: Math.round((downloaded / model.diskSizeBytes) * 100),
      }, options.onProgress);
    }

    // 2. Checksum verification phase
    this.updateProgress({
      ...this.currentProgress!,
      state: "VERIFYING_CHECKSUM",
    }, options.onProgress);

    if (options.mockDownloadDelayMs) {
      await new Promise((r) => setTimeout(r, options.mockDownloadDelayMs));
    }

    // 3. Smoke test phase
    this.updateProgress({
      ...this.currentProgress!,
      state: "RUNNING_SMOKE_TEST",
    }, options.onProgress);

    if (options.mockDownloadDelayMs) {
      await new Promise((r) => setTimeout(r, options.mockDownloadDelayMs));
    }

    const smokeResult = options.mockSmokeTestResult ?? { success: true };
    if (!smokeResult.success) {
      const msg = smokeResult.error ?? "Model smoke test failed: runtime did not return coherent output.";
      this.updateProgress({
        ...this.currentProgress!,
        state: "ERROR",
        smokeTestPassed: false,
        errorMessage: msg,
      }, options.onProgress);
      throw new Error(msg);
    }

    // 4. Ready phase
    this.updateProgress({
      ...this.currentProgress!,
      state: "READY",
      smokeTestPassed: true,
      errorMessage: null,
    }, options.onProgress);

    return this.currentProgress!;
  }

  public pause(): void {
    this.isPaused = true;
    if (this.currentProgress) {
      this.currentProgress.state = "PAUSED";
    }
  }

  public cancel(): void {
    this.isCancelled = true;
    this.activeDownloadController?.abort();
    if (this.currentProgress) {
      this.currentProgress.state = "CANCELLED";
      this.currentProgress.errorMessage = "Provisioning cancelled by user.";
    }
  }

  private updateProgress(
    progress: ProvisioningProgress,
    onProgress?: (progress: ProvisioningProgress) => void,
  ): void {
    this.currentProgress = progress;
    if (onProgress) {
      onProgress(progress);
    }
  }
}
