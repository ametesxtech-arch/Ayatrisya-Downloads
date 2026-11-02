const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { validateRemoteEndpointSecurity, redactDiagnosticData } = require("../security/policy.cjs");

const VAULT_FILE_NAME = "remotes.vault.json";
const SETTINGS_FILE_NAME = "routing.json";

class ConnectionManager {
  constructor({ userDataDir, fetchFn = globalThis.fetch, safeStorage = null } = {}) {
    this.userDataDir = userDataDir || process.cwd();
    this.fetchFn = fetchFn;
    this.safeStorage = safeStorage;
    this.vaultPath = path.join(this.userDataDir, VAULT_FILE_NAME);
    this.settingsPath = path.join(this.userDataDir, SETTINGS_FILE_NAME);

    // Default policy
    this.routingPolicy = "ask-each-time"; // "local-only" | "ayatrisya-cloud" | "custom-remote" | "ask-each-time"
    this.endpoints = new Map(); // id -> { id, name, endpointUrl, modelName, encryptedKey, createdAt, lastTestedAt, lastLatencyMs, isHealthy, discoveredModels }
  }

  async init() {
    await this.loadSettings();
    await this.loadVault();
  }

  // Derive a fallback encryption key if Electron safeStorage is unavailable in headless/test environments
  _getFallbackKey() {
    const machineSeed = process.env.COMPUTERNAME || process.env.HOSTNAME || "ayatrisya-desktop-seed";
    return crypto.scryptSync(machineSeed, "ayatrisya-salt-v1", 32);
  }

  _encryptSecret(plainText) {
    if (!plainText) return "";
    if (this.safeStorage && this.safeStorage.isEncryptionAvailable()) {
      return this.safeStorage.encryptString(plainText).toString("base64");
    }
    // AES-256-GCM encryption
    const iv = crypto.randomBytes(12);
    const key = this._getFallbackKey();
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return JSON.stringify({
      iv: iv.toString("hex"),
      tag: tag.toString("hex"),
      data: encrypted.toString("hex"),
    });
  }

  _decryptSecret(cipherText) {
    if (!cipherText) return "";
    try {
      if (this.safeStorage && this.safeStorage.isEncryptionAvailable()) {
        return this.safeStorage.decryptString(Buffer.from(cipherText, "base64"));
      }
      const parsed = JSON.parse(cipherText);
      const iv = Buffer.from(parsed.iv, "hex");
      const tag = Buffer.from(parsed.tag, "hex");
      const data = Buffer.from(parsed.data, "hex");
      const key = this._getFallbackKey();
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    } catch {
      return "";
    }
  }

  async loadSettings() {
    try {
      const raw = await fs.readFile(this.settingsPath, "utf8");
      const parsed = JSON.parse(raw);
      if (["local-only", "ayatrisya-cloud", "custom-remote", "ask-each-time"].includes(parsed.routingPolicy)) {
        this.routingPolicy = parsed.routingPolicy;
      }
    } catch {
      // Default policy remains
    }
  }

  async saveSettings() {
    await fs.mkdir(this.userDataDir, { recursive: true });
    await fs.writeFile(this.settingsPath, JSON.stringify({ routingPolicy: this.routingPolicy }, null, 2), "utf8");
  }

  async loadVault() {
    try {
      const raw = await fs.readFile(this.vaultPath, "utf8");
      const entries = JSON.parse(raw);
      if (Array.isArray(entries)) {
        for (const entry of entries) {
          if (entry.id && entry.endpointUrl) {
            this.endpoints.set(entry.id, entry);
          }
        }
      }
    } catch {
      // Empty vault
    }
  }

  async saveVault() {
    await fs.mkdir(this.userDataDir, { recursive: true });
    const entries = Array.from(this.endpoints.values());
    await fs.writeFile(this.vaultPath, JSON.stringify(entries, null, 2), "utf8");
  }

  getRoutingPolicy() {
    return this.routingPolicy;
  }

  async setRoutingPolicy(policy) {
    if (!["local-only", "ayatrisya-cloud", "custom-remote", "ask-each-time"].includes(policy)) {
      throw new Error(`Invalid routing policy: '${policy}'`);
    }
    this.routingPolicy = policy;
    await this.saveSettings();
    return this.routingPolicy;
  }

  listEndpoints() {
    // Return sanitized list to frontend (NEVER expose decrypted API key or raw ciphertext)
    return Array.from(this.endpoints.values()).map((e) => ({
      id: e.id,
      name: e.name,
      endpointUrl: e.endpointUrl,
      modelName: e.modelName,
      hasApiKey: Boolean(e.encryptedKey),
      createdAt: e.createdAt,
      lastTestedAt: e.lastTestedAt,
      lastLatencyMs: e.lastLatencyMs,
      isHealthy: Boolean(e.isHealthy),
      discoveredModels: e.discoveredModels || [],
    }));
  }

  async saveEndpoint({ id, name, endpointUrl, modelName, apiKey }) {
    const sec = validateRemoteEndpointSecurity(endpointUrl);
    if (!sec.valid) {
      throw new Error(sec.error);
    }

    const endpointId = id || crypto.randomUUID();
    const existing = this.endpoints.get(endpointId);

    let encryptedKey = existing ? existing.encryptedKey : "";
    if (apiKey !== undefined && apiKey !== null && apiKey !== "") {
      encryptedKey = this._encryptSecret(apiKey);
    }

    const record = {
      id: endpointId,
      name: name || "Custom Endpoint",
      endpointUrl: sec.sanitizedUrl,
      modelName: modelName || "default",
      encryptedKey,
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      lastTestedAt: existing ? existing.lastTestedAt : null,
      lastLatencyMs: existing ? existing.lastLatencyMs : null,
      isHealthy: existing ? existing.isHealthy : false,
      discoveredModels: existing ? existing.discoveredModels : [],
    };

    this.endpoints.set(endpointId, record);
    await this.saveVault();
    return record.id;
  }

  async removeEndpoint(id) {
    const deleted = this.endpoints.delete(id);
    if (deleted) {
      await this.saveVault();
    }
    return deleted;
  }

  async testEndpoint({ endpointUrl, apiKey, timeoutMs = 8000 }) {
    const sec = validateRemoteEndpointSecurity(endpointUrl);
    if (!sec.valid) {
      return { success: false, latencyMs: 0, models: [], error: sec.error };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startMs = Date.now();

    try {
      const headers = { "Content-Type": "application/json" };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const res = await this.fetchFn(`${sec.sanitizedUrl}/models`, {
        headers,
        signal: controller.signal,
      });

      const elapsed = Date.now() - startMs;
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return {
          success: false,
          latencyMs: elapsed,
          models: [],
          error: redactDiagnosticData(`Remote server returned HTTP ${res.status}: ${body.slice(0, 150)}`),
        };
      }

      const data = await res.json().catch(() => ({}));
      const models = Array.isArray(data?.data)
        ? data.data.map((m) => m.id || m.name).filter(Boolean)
        : Array.isArray(data?.models)
        ? data.models.map((m) => m.name || m.id).filter(Boolean)
        : [];

      return {
        success: true,
        latencyMs: elapsed,
        models,
        error: null,
      };
    } catch (err) {
      const elapsed = Date.now() - startMs;
      return {
        success: false,
        latencyMs: elapsed,
        models: [],
        error: redactDiagnosticData(controller.signal.aborted ? "Connection test timed out." : err.message),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async testAyatrisyaGateway({ gatewayUrl, token, timeoutMs = 8000 }) {
    const sec = validateRemoteEndpointSecurity(gatewayUrl);
    if (!sec.valid) {
      return {
        gatewayHealthy: false,
        chatModelAvailable: false,
        latencyMs: 0,
        models: [],
        error: sec.error,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startMs = Date.now();

    try {
      // Step 1: Gateway health check
      const healthRes = await this.fetchFn(`${sec.sanitizedUrl}/health`, {
        signal: controller.signal,
      });

      if (!healthRes.ok) {
        return {
          gatewayHealthy: false,
          chatModelAvailable: false,
          latencyMs: Date.now() - startMs,
          models: [],
          error: `Gateway returned status ${healthRes.status}`,
        };
      }

      // Step 2: Underlying chat model readiness check (never assume gateway healthy = chat available)
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      let chatModelAvailable = false;
      let models = [];

      try {
        const modelsRes = await this.fetchFn(`${sec.sanitizedUrl}/api/models`, {
          headers,
          signal: controller.signal,
        });
        if (modelsRes.ok) {
          const body = await modelsRes.json();
          models = Array.isArray(body?.models) ? body.models.map((m) => m.id || m.name) : [];
          chatModelAvailable = models.length > 0;
        }
      } catch {
        chatModelAvailable = false;
      }

      const elapsed = Date.now() - startMs;
      return {
        gatewayHealthy: true,
        chatModelAvailable,
        latencyMs: elapsed,
        models,
        error: null,
      };
    } catch (err) {
      return {
        gatewayHealthy: false,
        chatModelAvailable: false,
        latencyMs: Date.now() - startMs,
        models: [],
        error: redactDiagnosticData(err.message),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  resolveRoute({ requestedRoute = null, isOnline = true }) {
    const policy = this.routingPolicy;

    if (policy === "local-only") {
      return {
        route: "local",
        targetName: "Local CPU Model",
        isOffline: true,
        requiresConsent: false,
      };
    }

    if (requestedRoute === "local") {
      return {
        route: "local",
        targetName: "Local CPU Model",
        isOffline: true,
        requiresConsent: false,
      };
    }

    if (!isOnline && policy !== "local-only") {
      throw new Error(
        "Network offline: Cloud or remote connection requested, but no internet connection is detected. Please select 'Local CPU' to work offline."
      );
    }

    if (policy === "ask-each-time" && !requestedRoute) {
      return {
        route: "ask-each-time",
        targetName: "User Selection Required",
        isOffline: false,
        requiresConsent: true,
      };
    }

    if (policy === "ayatrisya-cloud" || requestedRoute === "ayatrisya-cloud") {
      return {
        route: "ayatrisya-cloud",
        targetName: "Ayatrisya Cloud Gateway",
        isOffline: false,
        requiresConsent: false,
      };
    }

    if (policy === "custom-remote" || requestedRoute === "custom-remote") {
      return {
        route: "custom-remote",
        targetName: "Configured Remote Model",
        isOffline: false,
        requiresConsent: false,
      };
    }

    return {
      route: "local",
      targetName: "Local CPU Model",
      isOffline: true,
      requiresConsent: false,
    };
  }
}

module.exports = {
  ConnectionManager,
  VAULT_FILE_NAME,
  SETTINGS_FILE_NAME,
};
