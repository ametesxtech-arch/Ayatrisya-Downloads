import { apiFetch } from "@/lib/api-config";

export interface RemoteDevice {
  deviceId: string;
  deviceName: string;
  platform: "windows" | "linux" | "macos";
  status: "idle" | "busy" | "offline";
  capabilities: string[];
  lastSeenAt: string;
}

export interface RemoteJob {
  jobId: string;
  userUid: string;
  deviceId: string;
  capability: string;
  action: string;
  state: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress?: number;
  statusMessage?: string;
  result?: unknown;
  error?: string;
  desktopSignature?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SubmitJobResponse {
  jobId: string;
  state: RemoteJob["state"];
  duplicate?: boolean;
  createdAt?: string;
  deviceId?: string;
}

/**
 * Client for interacting with the Render API Remote Access gateway.
 * Preserves secure pairing, authorization, and honest desktop job progress.
 */
export class AyatrisyaRemoteClient {
  /**
   * Retrieves list of registered devices for the authenticated user.
   */
  async listDevices(): Promise<RemoteDevice[]> {
    const data = await apiFetch<{ devices: RemoteDevice[] }>("/api/remote/devices");
    return data.devices || [];
  }

  /**
   * Pairs with a desktop using a one-time pairing code.
   */
  async pairWithCode(pairingCode: string): Promise<{ success: boolean; sessionToken: string; deviceId: string; expiresAt: string }> {
    return apiFetch("/api/remote/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairingCode }),
    });
  }

  /**
   * Retrieves the current availability and pairing status of a device.
   */
  async getDeviceStatus(deviceId: string): Promise<{ paired: boolean; device?: RemoteDevice }> {
    return apiFetch(`/api/remote/status?deviceId=${encodeURIComponent(deviceId)}`);
  }

  /**
   * Submits a general remote job to be picked up by the user's paired desktop.
   */
  async submitJob(params: {
    deviceId?: string;
    capability: string;
    action: string;
    payload?: unknown;
    idempotencyKey?: string;
  }): Promise<SubmitJobResponse> {
    return apiFetch<SubmitJobResponse>("/api/remote/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  }

  /**
   * Submits a coding command execution request to the user's online desktop.
   * Strictly requires a connected desktop; never routes to cloud.
   */
  async executeCodingCommand(params: {
    command: string;
    projectId?: string;
    idempotencyKey?: string;
  }): Promise<SubmitJobResponse> {
    return apiFetch<SubmitJobResponse>("/api/remote/coding/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  }

  /**
   * Submits a project filesystem operation (read/write/list) to the paired desktop.
   */
  async executeProjectOperation(params: {
    operation: "list" | "read" | "write" | "create";
    projectId: string;
    relativePath?: string;
    content?: string;
  }): Promise<SubmitJobResponse> {
    return apiFetch<SubmitJobResponse>("/api/remote/projects/operation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  }

  /**
   * Submits a game build job to the user's desktop toolchain.
   */
  async executeGameBuild(params: {
    targetPlatform: string;
    projectPath: string;
    idempotencyKey?: string;
  }): Promise<SubmitJobResponse> {
    return apiFetch<SubmitJobResponse>("/api/remote/game-build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  }

  /**
   * Fetches the current execution status and verified results of a remote job.
   */
  async getJob(jobId: string): Promise<RemoteJob> {
    const data = await apiFetch<{ job: RemoteJob }>(`/api/remote/jobs/${encodeURIComponent(jobId)}`);
    if (!data.job) {
      throw new Error("Job not found.");
    }
    return data.job;
  }

  /**
   * Polls a submitted remote job until completion, failure, cancellation, or timeout.
   * Never reports success until the desktop explicitly confirms with state === 'completed'.
   */
  async pollJobUntilDone(
    jobId: string,
    options: {
      pollIntervalMs?: number;
      timeoutMs?: number;
      signal?: AbortSignal;
      onProgress?: (job: RemoteJob) => void;
    } = {},
  ): Promise<RemoteJob> {
    const { pollIntervalMs = 1500, timeoutMs = 180_000, signal, onProgress } = options;
    const startTime = Date.now();

    while (true) {
      if (signal?.aborted) {
        throw new DOMException("Remote job monitoring was cancelled.", "AbortError");
      }

      if (Date.now() - startTime > timeoutMs) {
        throw new DOMException(`Timed out waiting for desktop job ${jobId} to complete.`, "TimeoutError");
      }

      const job = await this.getJob(jobId);
      if (onProgress) {
        onProgress(job);
      }

      if (job.state === "completed") {
        return job;
      }

      if (job.state === "failed") {
        throw new Error(job.error || "The remote desktop job failed during execution.");
      }

      if (job.state === "cancelled") {
        throw new DOMException("The remote desktop job was cancelled.", "AbortError");
      }

      // Wait before polling again
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, pollIntervalMs);
        if (signal) {
          signal.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(new DOMException("Remote job monitoring was cancelled.", "AbortError"));
            },
            { once: true },
          );
        }
      });
    }
  }
}

export const remoteClient = new AyatrisyaRemoteClient();
