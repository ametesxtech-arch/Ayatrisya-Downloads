const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs/promises");
const { assertLoopbackAddress } = require("../security/policy.cjs");

const DEFAULT_PORT = 49384;
const STARTUP_TIMEOUT_MS = 25000;
const REQUEST_TIMEOUT_MS = 60000;

class LlamaAdapter {
  constructor(options = {}) {
    this.port = options.port || DEFAULT_PORT;
    this.host = "127.0.0.1";
    this.endpoint = `http://${this.host}:${this.port}`;
    assertLoopbackAddress(this.endpoint);

    this.binDir = options.binDir || path.join(process.cwd(), "bin");
    this.fetchFn = options.fetchFn || globalThis.fetch;
    this.spawnFn = options.spawnFn || spawn;
    this.activeProcess = null;
    this.activeModelPath = null;
    this.state = "STOPPED"; // "STOPPED" | "STARTING" | "READY" | "BUSY" | "ERROR"
    this.lastError = null;
  }

  async findBinary() {
    const binName = process.platform === "win32" ? "llama-server.exe" : "llama-server";
    const searchPaths = [
      path.join(this.binDir, binName),
      path.join(process.cwd(), "resources", "bin", binName),
      path.join(process.cwd(), "bin", binName),
    ];

    for (const p of searchPaths) {
      try {
        const stat = await fs.stat(p);
        if (stat.isFile()) return p;
      } catch {
        // Continue search
      }
    }
    return null;
  }

  async checkHealth(timeoutMs = 2000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await this.fetchFn(`${this.endpoint}/health`, {
        signal: controller.signal,
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  async start({ modelPath, threads = 4, contextSize = 2048, gpuLayers = 0, mockProcess = null }) {
    if (this.state === "READY" || this.state === "BUSY") {
      if (this.activeModelPath === modelPath) {
        return this.getStatus();
      }
      await this.stop();
    }

    if (!modelPath || typeof modelPath !== "string") {
      throw new Error("A valid GGUF model path is required to start llama-server.");
    }

    this.state = "STARTING";
    this.activeModelPath = modelPath;
    this.lastError = null;

    if (mockProcess) {
      this.activeProcess = mockProcess;
      this.state = "READY";
      return this.getStatus();
    }

    const binary = await this.findBinary();
    if (!binary) {
      this.state = "ERROR";
      this.lastError = "llama-server binary was not found in the application bin directory.";
      throw new Error(this.lastError);
    }

    const boundedThreads = Math.max(1, Math.min(threads, 16));
    const args = [
      "-m", modelPath,
      "--host", this.host,
      "--port", String(this.port),
      "--threads", String(boundedThreads),
      "--ctx-size", String(contextSize),
      "--n-gpu-layers", String(gpuLayers),
      "--cont-batching",
    ];

    try {
      this.activeProcess = this.spawnFn(binary, args, {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      this.activeProcess.on("error", (err) => {
        this.state = "ERROR";
        this.lastError = `Process error: ${err.message}`;
        this.activeProcess = null;
      });

      this.activeProcess.on("exit", (code) => {
        if (this.state === "READY" || this.state === "BUSY") {
          this.state = "STOPPED";
          this.lastError = `llama-server exited with code ${code}`;
        }
        this.activeProcess = null;
      });

      // Poll loopback health
      const startMs = Date.now();
      let healthy = false;
      while (Date.now() - startMs < STARTUP_TIMEOUT_MS) {
        healthy = await this.checkHealth(1000);
        if (healthy) break;
        await new Promise((r) => setTimeout(r, 400));
      }

      if (!healthy) {
        await this.stop();
        this.state = "ERROR";
        this.lastError = "llama-server started but did not respond to health check in time.";
        throw new Error(this.lastError);
      }

      this.state = "READY";
      return this.getStatus();
    } catch (err) {
      this.state = "ERROR";
      this.lastError = err.message;
      await this.stop();
      throw err;
    }
  }

  async stop() {
    if (this.activeProcess) {
      try {
        this.activeProcess.kill();
      } catch {
        // Ignore kill errors if already stopped
      }
      this.activeProcess = null;
    }
    this.state = "STOPPED";
    this.activeModelPath = null;
    return this.getStatus();
  }

  async chatCompletion({ messages, temperature = 0.7, maxTokens = 512, signal }) {
    if (this.state !== "READY" && this.state !== "BUSY") {
      throw new Error(`llama-server is not ready (current state: ${this.state}).`);
    }

    this.state = "BUSY";
    const startMs = Date.now();

    try {
      const payload = {
        messages: messages.map((m) => ({
          role: m.role || "user",
          content: m.content || "",
        })),
        temperature,
        max_tokens: maxTokens,
        stream: false,
      };

      const res = await this.fetchFn(`${this.endpoint}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`llama-server request failed with status ${res.status}: ${text.slice(0, 200)}`);
      }

      const data = await res.json();
      const elapsed = Date.now() - startMs;
      const choice = data.choices?.[0];
      const content = choice?.message?.content || "";
      const usage = data.usage || {};

      return {
        content,
        role: "assistant",
        latencyMs: elapsed,
        usage: {
          promptTokens: usage.prompt_tokens || 0,
          completionTokens: usage.completion_tokens || 0,
          totalTokens: usage.total_tokens || 0,
        },
        tokensPerSec: usage.completion_tokens && elapsed > 0
          ? Number(((usage.completion_tokens / elapsed) * 1000).toFixed(1))
          : 0,
      };
    } finally {
      if (this.state === "BUSY") {
        this.state = "READY";
      }
    }
  }

  getStatus() {
    return {
      state: this.state,
      port: this.port,
      endpoint: this.endpoint,
      model: this.activeModelPath ? path.basename(this.activeModelPath) : null,
      error: this.lastError,
    };
  }
}

module.exports = {
  LlamaAdapter,
  DEFAULT_PORT,
};
