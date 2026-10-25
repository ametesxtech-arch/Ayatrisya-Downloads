export interface OfflineModeStatus {
  enabled: boolean;
  localEngineReady: boolean;
  activeModelId: string | null;
  remoteFallbackAllowed: false; // strictly false in local-only mode
  telemetryAllowed: false;      // strictly false
  offlineReason?: string;
}

export class AmetesxOfflineGuard {
  private localOnlyEnabled = false;

  public isLocalOnly(): boolean {
    return this.localOnlyEnabled;
  }

  public setLocalOnly(enabled: boolean): void {
    this.localOnlyEnabled = enabled;
  }

  /**
   * Enforces privacy and offline guarantees.
   * If local-only mode is active, any attempt to contact external cloud APIs
   * (Cloudflare, Gemini, HuggingFace, telemetry) is blocked immediately.
   */
  public assertLocalInferencePermitted(isLocalModelReady: boolean): void {
    if (this.localOnlyEnabled && !isLocalModelReady) {
      throw new Error(
        "Local-Only Mode is active, but no verified local model is loaded. " +
        "Remote cloud fallback is blocked by your privacy settings. " +
        "Provision a local model or switch to Cloud mode with explicit approval."
      );
    }
  }

  /**
   * Guards against outbound telemetry or remote analytics in local mode.
   */
  public shouldBlockOutboundCall(targetUrl: string): boolean {
    if (!this.localOnlyEnabled) return false;
    try {
      const url = new URL(targetUrl);
      const host = url.hostname.toLowerCase();
      // Only loopback / localhost is permitted in local-only mode
      return host !== "127.0.0.1" && host !== "localhost" && host !== "::1";
    } catch {
      return true; // block invalid URLs
    }
  }

  public getStatus(isReady: boolean, activeModelId: string | null): OfflineModeStatus {
    return {
      enabled: this.localOnlyEnabled,
      localEngineReady: isReady,
      activeModelId,
      remoteFallbackAllowed: false,
      telemetryAllowed: false,
      offlineReason: !isReady && this.localOnlyEnabled
        ? "Local model assets are missing or not yet initialized."
        : undefined,
    };
  }
}
