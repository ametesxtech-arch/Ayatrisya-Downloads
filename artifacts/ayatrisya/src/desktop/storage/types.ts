export type ModelInstallationStatus =
  | "NOT_INSTALLED"
  | "DOWNLOADING"
  | "PAUSED"
  | "VERIFYING"
  | "INSTALLED"
  | "CORRUPTED"
  | "ERROR";

export interface InstalledModelMetadata {
  id: string;
  name: string;
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  expectedSha256: string;
  verifiedSha256: string;
  installedAt: string;
  lastUsedAt?: string;
  isCorrupted?: boolean;
}

export interface StorageManifest {
  version: 1;
  modelsDir: string;
  installedModels: Record<string, InstalledModelMetadata>;
  updatedAt: string;
}

export interface DownloadProgress {
  modelId: string;
  status: ModelInstallationStatus;
  bytesDownloaded: number;
  totalBytes: number;
  progressPercent: number;
  speedBytesPerSec: number;
  etaSeconds: number;
  errorMessage?: string;
}
