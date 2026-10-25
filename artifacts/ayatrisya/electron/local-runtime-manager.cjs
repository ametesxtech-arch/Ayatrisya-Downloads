const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const { detectHardware } = require("./hardware-detector.cjs");

const HOST = "127.0.0.1";
const DEFAULT_PORT = 49384;
const STARTUP_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_PROMPT_CHARS = 16_384;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

/**
 * Validates that an endpoint target strictly binds to loopback.
 */
function assertLoopbackAddress(targetUrl) {
  const url = new URL(targetUrl);
  const host = url.hostname.toLowerCase();
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1" && host !== "[::1]") {
    throw new Error("Local runtime must bind only to loopback (127.0.0.1). Remote network targets are prohibited.");
  }
}


/**
 * App-managed local inference runtime manager.
 * Evaluates llama.cpp (MIT license) runtime, manages loopback lifecycle,
 * and detects physical acceleration (CUDA / DirectML / CPU).
 */
function createLocalRuntimeManager({
  port = DEFAULT_PORT,
  userDataDir = "",
  fetchFn = globalThis.fetch,
  spawnFn = spawn,
} = {}) {
  let state = "STOPPED"; // "STOPPED" | "STARTING" | "READY" | "BUSY" | "ERROR"
  let activeProcess = null;
  let activeModelPath = null;
  let activeBackend = "CPU"; // "CUDA" | "DIRECTML" | "METAL" | "CPU"
  let statusMessage = "Local runtime stopped.";
  let detectedHardware = null;
  const activeRequests = new Map();

  async function getHardware() {
    if (!detectedHardware) {
      detectedHardware = await detectHardware();
    }
    return detectedHardware;
  }

  async function detectBackend() {
    const hw = await getHardware();
    if (hw.hasCuda && hw.gpuVendor === "NVIDIA") {
      return {
        backend: "CUDA",
        gpuName: hw.gpuModel,
        vramGb: hw.vramGb,
        cudaAvailable: true,
        recommendedGpuLayers: hw.vramGb >= 8 ? 33 : 16,
        description: `NVIDIA CUDA acceleration active via ${hw.gpuModel} (${hw.vramGb} GB VRAM).`,
      };
    }
    if (hw.hasMetal && hw.gpuVendor === "APPLE") {
      return {
        backend: "METAL",
        gpuName: hw.gpuModel,
        vramGb: hw.vramGb,
        cudaAvailable: false,
        recommendedGpuLayers: 33,
        description: "Apple Metal acceleration active with unified memory.",
      };
    }
    if (hw.hasDirectMl && hw.gpuVendor === "INTEL") {
      return {
        backend: "DIRECTML",
        gpuName: hw.gpuModel,
        vramGb: hw.vramGb,
        cudaAvailable: false,
        recommendedGpuLayers: 0,
        description: `Intel graphics detected (${hw.gpuModel}). Using CPU/DirectML backend with conservative memory bounds.`,
      };
    }
    return {
      backend: "CPU",
      gpuName: hw.gpuModel,
      vramGb: hw.vramGb,
      cudaAvailable: false,
      recommendedGpuLayers: 0,
      description: "CPU multi-threaded inference active. No compatible NVIDIA GPU detected.",
    };
  }

  async function findBinary() {
    // Check known app directory locations for llama-server
    const binaryName = process.platform === "win32" ? "llama-server.exe" : "llama-server";
    const candidates = [
      path.join(userDataDir, "bin", binaryName),
      path.join(process.cwd(), "resources", "bin", binaryName),
      path.join(process.cwd(), "bin", binaryName),
    ];
    for (const candidate of candidates) {
      try {
        const stat = await fs.stat(candidate);
        if (stat.isFile()) return candidate;
      } catch {
        // Continue searching
      }
    }
    return null;
  }

  function getStatus() {
    return {
      state,
      port,
      host: HOST,
      endpoint: `http://${HOST}:${port}`,
      activeModel: activeModelPath ? path.basename(activeModelPath) : null,
      backend: activeBackend,
      activeRequests: activeRequests.size,
      message: statusMessage,
      hardware: detectedHardware ? {
        gpuVendor: detectedHardware.gpuVendor,
        gpuModel: detectedHardware.gpuModel,
        vramGb: detectedHardware.vramGb,
        hasCuda: detectedHardware.hasCuda,
        cpuCores: detectedHardware.cpuCores,
      } : null,
    };
  }

  async function checkHealth(timeoutMs = 3000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchFn(`http://${HOST}:${port}/health`, {
        signal: controller.signal,
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  async function start(modelPath, options = {}) {
    if (state === "READY" || state === "BUSY") {
      if (activeModelPath === modelPath) return getStatus();
      await stop();
    }

    if (typeof modelPath !== "string" || !modelPath.trim()) {
      throw new Error("Provide a valid local model GGUF file path.");
    }

    state = "STARTING";
    activeModelPath = modelPath;
    statusMessage = "Detecting acceleration backend and initializing runtime...";

    const backendInfo = await detectBackend();
    activeBackend = backendInfo.backend;
    const binary = await findBinary();

    // Check if binary is present
    if (!binary && !options.mockProcess) {
      // Honest reporting: binary not packaged yet
      state = "ERROR";
      statusMessage = "Bundled llama.cpp runtime binary not found in app directory. Automatic runtime download or manual binary placement in userData/bin is pending.";
      return getStatus();
    }

    const cpuCores = detectedHardware?.cpuCores || 4;
    const gpuLayers = backendInfo.recommendedGpuLayers;

    const args = [
      "-m", modelPath,
      "--host", HOST,
      "--port", String(port),
      "--threads", String(Math.max(1, cpuCores - 1)),
      "--n-gpu-layers", String(gpuLayers),
      "--ctx-size", String(options.contextSize || 4096),
    ];

    if (options.mockProcess) {
      activeProcess = options.mockProcess;
    } else {
      activeProcess = spawnFn(binary, args, {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      activeProcess.on("error", (err) => {
        state = "ERROR";
        statusMessage = `Runtime process error: ${err.message}`;
        activeProcess = null;
      });

      activeProcess.on("exit", (code) => {
        if (state === "READY" || state === "BUSY") {
          state = "STOPPED";
          statusMessage = `Runtime exited with code ${code}.`;
        }
        activeProcess = null;
      });
    }

    // Wait for loopback server to respond to health check
    const startTime = Date.now();
    let isHealthy = false;
    while (Date.now() - startTime < STARTUP_TIMEOUT_MS) {
      if (options.mockProcess) {
        isHealthy = true;
        break;
      }
      isHealthy = await checkHealth(1000);
      if (isHealthy) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!isHealthy) {
      await stop();
      state = "ERROR";
      statusMessage = "Runtime process started but did not respond to loopback health check within timeout.";
      throw new Error(statusMessage);
    }

    state = "READY";
    statusMessage = `Local runtime ready with ${activeBackend} backend.`;
    return getStatus();
  }

  async function stop() {
    if (activeProcess) {
      try {
        activeProcess.kill();
      } catch {
        // Process might already be stopped
      }
      activeProcess = null;
    }
    state = "STOPPED";
    activeModelPath = null;
    statusMessage = "Local runtime stopped.";
    activeRequests.clear();
    return getStatus();
  }

  async function generate(prompt, requestId, options = {}) {
    if (state !== "READY" && state !== "BUSY") {
      throw new Error("Local runtime is not ready. Start the runtime first.");
    }
    if (typeof prompt !== "string" || !prompt.trim()) {
      throw new Error("Enter a prompt for generation.");
    }
    if (prompt.length > MAX_PROMPT_CHARS) {
      throw new Error(`Prompt exceeds maximum length of ${MAX_PROMPT_CHARS} characters.`);
    }

    state = "BUSY";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs || REQUEST_TIMEOUT_MS);
    activeRequests.set(requestId, controller);

    try {
      const url = `http://${HOST}:${port}/completion`;
      assertLoopbackAddress(url);

      const res = await fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          n_predict: options.maxTokens || 512,
          temperature: options.temperature ?? 0.7,
          stop: ["</s>", "<|im_end|>", "\n\nUser:"],
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Local inference server returned status ${res.status}`);
      }

      const body = await res.json();
      const content = String(body.content || body.text || "").trim();

      if (!content) {
        throw new Error("Local inference server returned empty text.");
      }

      return {
        requestId,
        text: content,
        backend: activeBackend,
        model: path.basename(activeModelPath || "unknown"),
        tokensGenerated: body.tokens_predicted || Math.round(content.length / 4),
      };
    } catch (err) {
      if (controller.signal.aborted) {
        throw new Error("Local inference request was cancelled or timed out.");
      }
      throw err;
    } finally {
      clearTimeout(timer);
      activeRequests.delete(requestId);
      state = activeRequests.size > 0 ? "BUSY" : "READY";
    }
  }

  function cancel(requestId) {
    const controller = activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      activeRequests.delete(requestId);
      if (activeRequests.size === 0 && state === "BUSY") {
        state = "READY";
      }
      return true;
    }
    return false;
  }

  return {
    getStatus,
    detectBackend,
    start,
    stop,
    generate,
    cancel,
    assertLoopbackAddress,
  };
}

module.exports = {
  createLocalRuntimeManager,
  assertLoopbackAddress,
  DEFAULT_PORT,
};
