import type { AyatrisyaDesktopApi, DesktopModelRuntime, DesktopRuntimeInfo } from "./contracts";

export interface VerifiedDesktopRuntime {
  api: AyatrisyaDesktopApi;
  info: DesktopRuntimeInfo;
}

const allowedCapabilities = new Set([
  "local-model-ipc",
  "local-seed-model-host",
  "local-project-files",
  "confirmed-command-runner",
  "war-mode-yara",
  "microsoft-defender",
  "ametesx-local-ai",
]);

const allowedModalities = new Set(["chat", "image", "3d", "music", "stt", "tts"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeModels(value: unknown): DesktopModelRuntime[] {
  if (!Array.isArray(value)) return [];
  const models: DesktopModelRuntime[] = [];
  for (const item of value.slice(0, 16)) {
    if (!isRecord(item) || !["v1-fast", "v2-best"].includes(String(item.id)) || typeof item.available !== "boolean") continue;
    models.push({
      id: item.id as DesktopModelRuntime["id"],
      available: item.available,
      ...(typeof item.reason === "string" ? { reason: item.reason.slice(0, 200) } : {}),
      modalities: Array.isArray(item.modalities)
        ? [...new Set(item.modalities.filter((modality): modality is string =>
          typeof modality === "string" && allowedModalities.has(modality)))].slice(0, 12)
        : [],
    });
  }
  return models;
}

export function validateDesktopRuntimeInfo(value: unknown): DesktopRuntimeInfo | null {
  if (!isRecord(value) ||
      value.bridgeName !== "ayatrisya-desktop" ||
      value.apiVersion !== 1 ||
      typeof value.appVersion !== "string" ||
      !["win32", "darwin", "linux"].includes(String(value.platform)) ||
      !Array.isArray(value.capabilities) ||
      !isRecord(value.localModel) ||
      typeof value.localModel.endpointConfigured !== "boolean") {
    return null;
  }
  return {
    bridgeName: "ayatrisya-desktop",
    apiVersion: 1,
    appVersion: value.appVersion.slice(0, 40),
    platform: value.platform as DesktopRuntimeInfo["platform"],
    capabilities: value.capabilities
      .filter((capability): capability is string => typeof capability === "string" && allowedCapabilities.has(capability))
      .slice(0, 16),
    localModel: {
      endpointConfigured: value.localModel.endpointConfigured,
      models: normalizeModels(value.localModel.models),
    },
  };
}

let runtimePromise: Promise<VerifiedDesktopRuntime | null> | undefined;

export function resetDesktopRuntimeCache(): void {
  runtimePromise = undefined;
}

export function getVerifiedDesktopRuntime(forceRefresh = false): Promise<VerifiedDesktopRuntime | null> {
  const api = typeof window === "undefined" ? undefined : window.ayatrisyaDesktop;
  if (!api || api.isDesktop !== true || typeof api.getRuntimeInfo !== "function") return Promise.resolve(null);
  if (forceRefresh || !runtimePromise) {
    const handshake = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Desktop bridge handshake timed out.")), 5_000);
      api.getRuntimeInfo().then(
        (value) => { clearTimeout(timeout); resolve(value); },
        (error) => { clearTimeout(timeout); reject(error); },
      );
    });
    runtimePromise = handshake
      .then(validateDesktopRuntimeInfo)
      .then((info) => info ? { api, info } : null)
      .catch(() => null);
  }
  return runtimePromise;
}
