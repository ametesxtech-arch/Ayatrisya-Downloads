const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");

const HOST = "127.0.0.1";
const PORT = 49382;
const BASE_URL = `http://${HOST}:${PORT}`;
const CONFIG_FILE = "seed-model-host.json";
const BIND_MARKER = "Ayatrisya Seed API binds only to 127.0.0.1:49382.";
const MAX_PROMPT_CHARS = 8192;
const MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_CHECKPOINT_BYTES = 512 * 1024 * 1024;
const STARTUP_TIMEOUT_MS = 45_000;
const REQUEST_TIMEOUT_MS = 35_000;

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function publicStatus(state) {
  return {
    state: state.state,
    configured: Boolean(state.configured),
    autoStart: Boolean(state.autoStart),
    checkpointName: state.checkpointName ?? null,
    model: state.model ?? null,
    activeRequests: state.activeRequests ?? 0,
    message: String(state.message || "").slice(0, 240),
  };
}

async function validateCheckpoint(checkpointPath) {
  if (typeof checkpointPath !== "string" || checkpointPath.length > 4096 || !path.isAbsolute(checkpointPath)) {
    throw new Error("Choose an Ayatrisya Seed checkpoint from its local project folder.");
  }
  let checkpoint;
  try {
    checkpoint = await fs.realpath(checkpointPath);
  } catch {
    throw new Error("The selected checkpoint is not available on this computer.");
  }
  const stat = await fs.stat(checkpoint);
  const checkpointsDir = path.dirname(checkpoint);
  const modelRoot = path.dirname(checkpointsDir);
  if (path.extname(checkpoint).toLowerCase() !== ".pt" ||
      !stat.isFile() || stat.size < 1 || stat.size > MAX_CHECKPOINT_BYTES ||
      path.basename(checkpointsDir).toLowerCase() !== "checkpoints") {
    throw new Error("Select a valid checkpoint inside the Ayatrisya Seed checkpoints folder.");
  }
  const root = await fs.realpath(modelRoot);
  if (!isWithin(root, checkpoint) || !isWithin(root, checkpointsDir)) {
    throw new Error("The selected checkpoint must remain inside the Ayatrisya Seed project.");
  }
  for (const relative of [
    "inference/server.py",
    "inference/loader.py",
    "model/generation.py",
    "model/tokenizer.py",
    "model/transformer.py",
    "training/checkpoint.py",
  ]) {
    let required;
    try {
      required = await fs.realpath(path.join(root, relative));
    } catch {
      throw new Error("The selected folder is not a complete Ayatrisya Seed model project.");
    }
    if (!isWithin(root, required) || !(await fs.stat(required)).isFile()) {
      throw new Error("The selected folder is not a complete Ayatrisya Seed model project.");
    }
  }
  return {
    checkpointPath: checkpoint,
    modelRoot: root,
    checkpointName: path.basename(checkpoint),
  };
}

async function readJsonBounded(response, maxBytes = MAX_RESPONSE_BYTES) {
  if (!response.body) throw new Error("The local model host returned an empty response.");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new Error("The local model response exceeded the supported size.");
    }
    chunks.push(Buffer.from(value));
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("The local model host returned invalid JSON.");
  }
}

function pythonCommand(modelRoot, platform) {
  const executable = platform === "win32"
    ? path.join(modelRoot, ".venv", "Scripts", "python.exe")
    : path.join(modelRoot, ".venv", "bin", "python");
  return fs.access(executable).then(
    () => ({ command: executable, prefix: [] }),
    () => platform === "win32"
      ? ({ command: "py", prefix: ["-3"] })
      : ({ command: "python3", prefix: [] }),
  );
}

function safeRunnerEnvironment(source, platform = process.platform) {
  const env = {};
  for (const key of [
    "PATH", "PYTHONPATH", "SystemRoot", "TEMP", "TMP", "HOME",
    "USERPROFILE", "LOCALAPPDATA", "APPDATA",
  ]) {
    if (typeof source[key] === "string") env[key] = source[key];
  }
  if (platform === "win32" && typeof source.APPDATA === "string") {
    const fsSync = require("node:fs");
    const pyDir = path.join(source.APPDATA, "Python");
    try {
      if (fsSync.existsSync(pyDir)) {
        const subdirs = fsSync.readdirSync(pyDir);
        const siteDirs = subdirs
          .map((dir) => path.join(pyDir, dir, "site-packages"))
          .filter((dir) => fsSync.existsSync(dir));
        if (siteDirs.length > 0) {
          env.PYTHONPATH = [env.PYTHONPATH, ...siteDirs].filter(Boolean).join(path.delimiter);
        }
      }
    } catch {}
  }
  env.PYTHONUNBUFFERED = "1";
  env.PYTHONDONTWRITEBYTECODE = "1";
  env.PYTHONNOUSERSITE = "1";
  env.OMP_NUM_THREADS = "2";
  env.MKL_NUM_THREADS = "2";
  env.OPENBLAS_NUM_THREADS = "2";
  return env;
}

function createSeedModelHost({
  userDataDir,
  platform = process.platform,
  spawnProcess = spawn,
  fetchImpl = (...args) => fetch(...args),
  processEnv = process.env,
  startupTimeoutMs = STARTUP_TIMEOUT_MS,
  requestTimeoutMs = REQUEST_TIMEOUT_MS,
} = {}) {
  let config = null;
  let child = null;
  let expectedStop = false;
  let startupOutput = "";
  let spawnError = null;
  let exitCode = null;
  const activeRequests = new Map();
  let state = {
    state: "STOPPED",
    configured: false,
    autoStart: false,
    checkpointName: null,
    model: null,
    activeRequests: 0,
    message: "Choose a trusted Ayatrisya Seed checkpoint to configure the experimental local host.",
  };

  const configPath = () => path.join(userDataDir, CONFIG_FILE);

  async function persist() {
    if (!config || !userDataDir) return;
    await fs.mkdir(userDataDir, { recursive: true });
    const file = configPath();
    const temporary = `${file}.tmp`;
    await fs.writeFile(temporary, JSON.stringify({
      checkpointPath: config.checkpointPath,
      autoStart: config.autoStart,
    }), { mode: 0o600 });
    await fs.rename(temporary, file);
  }

  function setState(next) {
    state = {
      ...state,
      ...next,
      configured: Boolean(config),
      autoStart: Boolean(config?.autoStart),
      checkpointName: config?.checkpointName ?? null,
      activeRequests: activeRequests.size,
    };
  }

  async function load() {
    if (!userDataDir) return publicStatus(state);
    let saved;
    try {
      saved = JSON.parse(await fs.readFile(configPath(), "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") {
        const candidatePaths = [
          path.resolve("D:\\AYATRISYA AI\\Ayatrisya-AI-Workspace\\Ayatrisya_model\\checkpoints\\seed-expanded-experimental.pt"),
          path.resolve(process.cwd(), "Ayatrisya_model", "checkpoints", "seed-expanded-experimental.pt"),
          path.resolve(__dirname, "..", "..", "..", "Ayatrisya_model", "checkpoints", "seed-expanded-experimental.pt"),
          path.resolve(__dirname, "..", "Ayatrisya_model", "checkpoints", "seed-expanded-experimental.pt"),
          path.resolve(userDataDir, "..", "..", "Ayatrisya_model", "checkpoints", "seed-expanded-experimental.pt"),
          path.resolve(userDataDir, "models", "seed-expanded-experimental.pt"),
          path.resolve("D:\\AYATRISYA AI\\Ayatrisya-AI-Workspace\\Ayatrisya_model\\checkpoints\\seed-smoke.pt"),
          path.resolve(process.cwd(), "Ayatrisya_model", "checkpoints", "seed-smoke.pt"),
          path.resolve(__dirname, "..", "..", "..", "Ayatrisya_model", "checkpoints", "seed-smoke.pt"),
          path.resolve(userDataDir, "..", "..", "Ayatrisya_model", "checkpoints", "seed-smoke.pt"),
        ];
        for (const candidate of candidatePaths) {
          try {
            const checked = await validateCheckpoint(candidate);
            config = { ...checked, autoStart: true };
            setState({ state: "STOPPED", message: "Ayatrisya model checkpoint initialized. Ready for local inference." });
            await persist();
            break;
          } catch {
            // try next candidate
          }
        }
        return publicStatus(state);
      }
      setState({ state: "ERROR", message: "The saved local model host settings could not be read. Choose a checkpoint again." });
      return publicStatus(state);
    }
    try {
      const checked = await validateCheckpoint(saved?.checkpointPath);
      config = { ...checked, autoStart: saved.autoStart === true };
      setState({ state: "STOPPED", message: "Checkpoint selected. Start the experimental local host when you are ready." });
    } catch {
      config = null;
      setState({ state: "ERROR", message: "The saved checkpoint is unavailable or invalid. Choose a trusted Ayatrisya Seed checkpoint again." });
    }
    return publicStatus(state);
  }

  async function configureCheckpoint(checkpointPath) {
    const checked = await validateCheckpoint(checkpointPath);
    if (child) await stop();
    config = { ...checked, autoStart: false };
    setState({ state: "STOPPED", model: null, message: "Checkpoint selected. Start the experimental local host when you are ready." });
    await persist();
    return publicStatus(state);
  }

  async function setAutoStart(enabled) {
    if (typeof enabled !== "boolean") throw new Error("The automatic start setting is invalid.");
    if (!config) throw new Error("Choose a trusted local checkpoint first.");
    config.autoStart = enabled;
    await persist();
    setState({
      message: enabled
        ? "The experimental local model will start when Ayatrisya Desktop opens."
        : "Automatic start is off. Start the local model manually from Settings.",
    });
    return publicStatus(state);
  }

  function monitorChild(processChild) {
    processChild.stdout?.on("data", (chunk) => {
      startupOutput = `${startupOutput}${String(chunk)}`.slice(-4096);
    });
    processChild.stderr?.on("data", (chunk) => {
      // Drain errors so the pipe cannot block without retaining private paths or text.
      void chunk;
    });
    processChild.once("error", (error) => {
      spawnError = error;
    });
    processChild.once("exit", (code) => {
      exitCode = code;
      if (child !== processChild) return;
      child = null;
      if (expectedStop) {
        expectedStop = false;
        setState({ state: "STOPPED", model: null, message: "The local model host is stopped." });
      } else {
        setState({
          state: "ERROR",
          model: null,
          message: "The local model runner exited. Check Python and PyTorch setup, then start it again.",
        });
      }
    });
  }

  async function probe() {
    const response = await fetchImpl(`${BASE_URL}/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(1_500),
    });
    const body = await readJsonBounded(response, 16 * 1024);
    return { response, body };
  }

  async function start() {
    if (!config) throw new Error("Choose a trusted Ayatrisya Seed checkpoint first.");
    if (child && state.state === "READY") return publicStatus(state);
    if (child) await stop();

    state = {
      state: "STARTING",
      configured: true,
      autoStart: Boolean(config.autoStart),
      checkpointName: config.checkpointName,
      model: null,
      activeRequests: 0,
      message: "Starting the local Python model runner and loading its checkpoint…",
    };
    startupOutput = "";
    spawnError = null;
    exitCode = null;
    expectedStop = false;

    const python = await pythonCommand(config.modelRoot, platform);
    const args = [
      ...python.prefix,
      "-u",
      "-m",
      "inference.server",
      "--checkpoint",
      config.checkpointPath,
      "--device",
      "cpu",
    ];
    const processChild = spawnProcess(python.command, args, {
      cwd: config.modelRoot,
      env: safeRunnerEnvironment(processEnv),
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child = processChild;
    monitorChild(processChild);

    const deadline = Date.now() + startupTimeoutMs;
    try {
      while (Date.now() < deadline) {
        if (spawnError) {
          throw new Error("Python 3.10+ with PyTorch 2.6+ is required. Install the local Ayatrisya Seed dependencies, then retry.");
        }
        if (!child || child !== processChild || exitCode !== null) {
          throw new Error("The local model runner exited before it became ready. The loopback port may be in use, or Python dependencies may be missing.");
        }
        if (startupOutput.includes(BIND_MARKER)) {
          try {
            const { response, body } = await probe();
            if (response.ok && (body?.status === "ready" || body?.status === "ok")) {
              const model = {
                name: typeof body.model === "string" ? body.model.slice(0, 80) : "Ayatrisya Seed",
                parameterCount: Number.isInteger(body.parameter_count) ? body.parameter_count : null,
                trainingSteps: Number.isInteger(body.training_steps) ? body.training_steps : null,
                device: typeof body.device === "string" ? body.device.slice(0, 24) : "cpu",
                readiness: typeof body.readiness === "string" ? body.readiness.slice(0, 64) : "experimental",
              };
              setState({
                state: "READY",
                model,
                message: "Experimental checkpoint loaded. This model is not a dependable assistant and is not connected to chat.",
              });
              return publicStatus(state);
            }
            if (response.status === 503) {
              throw new Error(body?.error === "checkpoint_missing" || body?.error === "checkpoint_invalid"
                ? `The selected checkpoint could not load (${body.error}). Choose a valid Ayatrisya Seed checkpoint.`
                : "The local model runner is not ready. Check the selected checkpoint and try again.");
            }
          } catch (error) {
            if (
              error instanceof Error &&
              (error.message.startsWith("The selected checkpoint") ||
                error.message.startsWith("The local model runner is not ready"))
            ) {
              throw error;
            }
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      throw new Error("The local model did not become ready before the startup timeout.");
    } catch (error) {
      if (child === processChild) {
        expectedStop = true;
        if (platform === "win32") processChild.kill();
        else processChild.kill("SIGINT");
        child = null;
      }
      setState({
        state: "ERROR",
        model: null,
        message: error instanceof Error
          ? error.message
          : "The local model could not be started.",
      });
      throw new Error(state.message);
    }
  }

  async function startSaved() {
    if (!config?.autoStart) return publicStatus(state);
    try {
      return await start();
    } catch {
      return publicStatus(state);
    }
  }

  async function stop() {
    const processChild = child;
    expectedStop = true;
    for (const [requestId, controller] of activeRequests) {
      void fetchImpl(`${BASE_URL}/v1/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId }),
        redirect: "error",
        signal: AbortSignal.timeout(1_000),
      }).catch(() => undefined);
      controller.abort();
    }
    if (processChild) {
      if (platform === "win32") processChild.kill();
      else processChild.kill("SIGINT");
    }
    child = null;
    setState({ state: "STOPPED", model: null, message: "The local model host is stopped." });
    return publicStatus(state);
  }

  async function generateText(prompt, requestId) {
    if (state.state !== "READY" || !child) throw new Error("Start the local model host before sending a test prompt.");
    if (typeof prompt !== "string" || !prompt.trim() || prompt.length > MAX_PROMPT_CHARS) {
      throw new Error(`Enter a prompt between 1 and ${MAX_PROMPT_CHARS} characters.`);
    }
    if (typeof requestId !== "string" || !/^[a-f0-9]{32}$/i.test(requestId)) {
      throw new Error("The local model request ID is invalid.");
    }
    if (activeRequests.has(requestId) || activeRequests.size > 0) {
      throw new Error("The local model is already processing a request.");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    activeRequests.set(requestId, controller);
    setState({ activeRequests: activeRequests.size, message: "Generating a local experimental sample…" });
    try {
      const response = await fetchImpl(`${BASE_URL}/v1/generate`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: requestId,
          prompt,
          max_new_tokens: 32,
          temperature: 0.8,
          top_k: 40,
        }),
        redirect: "error",
        signal: controller.signal,
      });
      const body = await readJsonBounded(response);
      if (!response.ok) {
        const messages = {
          inference_busy: "The experimental model is busy. Wait and try again.",
          request_timeout: "The experimental model request timed out.",
          cancelled: "The experimental model request was cancelled.",
          checkpoint_missing: "The selected checkpoint is missing.",
          checkpoint_invalid: "The selected checkpoint is not compatible.",
          model_unavailable: "The experimental model is unavailable.",
        };
        throw new Error(messages[body?.error] || `The local model request failed (${response.status}).`);
      }
      if (typeof body?.generated_text !== "string" || body.model_status !== "experimental") {
        throw new Error("The local model returned an unsupported response.");
      }
      return {
        requestId,
        generatedText: body.generated_text.slice(0, 16_384),
        promptTruncated: body.prompt_truncated_to_context === true,
        modelStatus: "experimental",
      };
    } catch (error) {
      if (controller.signal.aborted) throw new Error("The local model request timed out or was cancelled.");
      throw error;
    } finally {
      clearTimeout(timer);
      activeRequests.delete(requestId);
      setState({
        activeRequests: activeRequests.size,
        message: activeRequests.size ? state.message : "Experimental test complete. The prompt and output were not saved by Ayatrisya.",
      });
    }
  }

  async function cancel(requestId) {
    if (typeof requestId !== "string" || !/^[a-f0-9]{32}$/i.test(requestId)) {
      throw new Error("The local model request ID is invalid.");
    }
    if (!activeRequests.has(requestId)) return false;
    try {
      const response = await fetchImpl(`${BASE_URL}/v1/cancel`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId }),
        redirect: "error",
        signal: AbortSignal.timeout(1_500),
      });
      const body = await readJsonBounded(response, 8 * 1024);
      return response.ok && body?.cancelled === true;
    } catch {
      activeRequests.get(requestId)?.abort();
      return false;
    }
  }

  return {
    load,
    configureCheckpoint,
    setAutoStart,
    start,
    startSaved,
    stop,
    getStatus: () => publicStatus(state),
    generateText,
    cancel,
  };
}

module.exports = {
  createSeedModelHost,
  validateCheckpoint,
  MAX_PROMPT_CHARS,
  PORT,
};
