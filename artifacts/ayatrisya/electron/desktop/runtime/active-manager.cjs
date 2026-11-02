const path = require("node:path");
const { LlamaAdapter } = require("./llama-adapter.cjs");
const { OllamaAdapter } = require("./ollama-adapter.cjs");

class ActiveModelManager {
  constructor({
    storageManager,
    hardwareProfiler = null,
    llamaAdapter = null,
    ollamaAdapter = null,
  } = {}) {
    this.storage = storageManager;
    this.hardwareProfiler = hardwareProfiler;
    this.llamaAdapter = llamaAdapter || new LlamaAdapter();
    this.ollamaAdapter = ollamaAdapter || new OllamaAdapter();

    this.activeModelId = null;
    this.activeModelPath = null;
    this.activeRuntime = null; // "llama-cpp" | "ollama" | null
    this.status = "UNLOADED"; // "UNLOADED" | "LOADING" | "READY" | "BUSY" | "ERROR"
    this.loadedAt = null;
    this.lastError = null;
    this.modelMetadata = null;
  }

  getStatus() {
    return {
      status: this.status,
      activeModelId: this.activeModelId,
      activeRuntime: this.activeRuntime,
      modelPath: this.activeModelPath,
      loadedAt: this.loadedAt,
      metadata: this.modelMetadata,
      error: this.lastError,
      endpoint:
        this.activeRuntime === "ollama"
          ? this.ollamaAdapter.endpoint
          : this.activeRuntime === "llama-cpp"
          ? this.llamaAdapter.endpoint
          : null,
    };
  }

  async loadModel(modelId, catalogEntry = null, options = {}) {
    if (this.status === "READY" && this.activeModelId === modelId) {
      return this.getStatus();
    }

    // Single active model policy: Unload any currently loaded model first to prevent OOM
    if (this.activeModelId || this.status === "READY" || this.status === "BUSY") {
      await this.unloadModel();
    }

    this.status = "LOADING";
    this.activeModelId = modelId;
    this.lastError = null;

    try {
      // 1. Verify model is installed in storage
      const installed = await this.storage.isInstalled(modelId);
      if (!installed && !options.allowOllamaPull) {
        throw new Error(
          `Model '${modelId}' is not installed locally. Please download it first from Models & Engines.`
        );
      }

      const modelPath = await this.storage.getModelFilePath(modelId);

      // 2. Hardware memory check if profiler is available
      if (this.hardwareProfiler && catalogEntry) {
        const profile = await this.hardwareProfiler.profileSystem();
        const availableRamGb = profile.availableRamGb;
        if (catalogEntry.minRamGb && availableRamGb < catalogEntry.minRamGb) {
          throw new Error(
            `Insufficient RAM: '${catalogEntry.name}' requires at least ${catalogEntry.minRamGb} GB RAM, but only ${availableRamGb.toFixed(1)} GB is currently available.`
          );
        }
      }

      // 3. Choose runtime
      const candidateRuntime = catalogEntry?.recommendedRuntime || "llama-cpp";

      if (candidateRuntime === "ollama") {
        const ollamaOnline = await this.ollamaAdapter.checkHealth();
        if (ollamaOnline) {
          this.activeRuntime = "ollama";
          this.activeModelPath = modelPath;
          this.modelMetadata = catalogEntry;
          this.status = "READY";
          this.loadedAt = new Date().toISOString();
          return this.getStatus();
        }
      }

      // Default or fallback to llama.cpp
      this.activeRuntime = "llama-cpp";
      this.activeModelPath = modelPath;
      this.modelMetadata = catalogEntry;

      const profile = this.hardwareProfiler ? await this.hardwareProfiler.profileSystem() : null;
      const threads = profile?.recommendedThreads || 4;
      const contextSize = catalogEntry?.contextWindow || 2048;

      await this.llamaAdapter.start({
        modelPath,
        threads,
        contextSize,
        gpuLayers: 0,
        mockProcess: options.mockProcess || null,
      });

      this.status = "READY";
      this.loadedAt = new Date().toISOString();
      return this.getStatus();
    } catch (err) {
      this.status = "ERROR";
      this.lastError = err.message;
      this.activeModelId = null;
      this.activeModelPath = null;
      this.activeRuntime = null;
      throw err;
    }
  }

  async unloadModel() {
    this.status = "UNLOADED";
    this.activeModelId = null;
    this.activeModelPath = null;
    this.loadedAt = null;
    this.lastError = null;
    this.modelMetadata = null;

    if (this.activeRuntime === "llama-cpp") {
      await this.llamaAdapter.stop().catch(() => {});
    }
    this.activeRuntime = null;
    return this.getStatus();
  }

  async chat({ messages, temperature = 0.7, maxTokens = 512, signal }) {
    if (this.status !== "READY") {
      throw new Error(`No local model is currently loaded. Status: ${this.status}`);
    }

    this.status = "BUSY";
    try {
      if (this.activeRuntime === "ollama") {
        return await this.ollamaAdapter.chatCompletion({
          model: this.activeModelId,
          messages,
          temperature,
          maxTokens,
          signal,
        });
      }

      if (this.activeRuntime === "llama-cpp") {
        return await this.llamaAdapter.chatCompletion({
          messages,
          temperature,
          maxTokens,
          signal,
        });
      }

      throw new Error(`Unsupported runtime: ${this.activeRuntime}`);
    } catch (err) {
      // If error indicates process died or crashed
      if (err.message?.includes("exited") || err.message?.includes("ECONNREFUSED")) {
        this.status = "ERROR";
        this.lastError = `Runtime crash during generation: ${err.message}`;
      }
      throw err;
    } finally {
      if (this.status === "BUSY") {
        this.status = "READY";
      }
    }
  }
}

module.exports = {
  ActiveModelManager,
};
