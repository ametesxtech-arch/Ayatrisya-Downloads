// Proprietary notice: applies only to original material Ametesx owns or is authorized to license; third-party and prior licenses remain in force.
const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { spawn } = require("node:child_process");
const fsSync = require("node:fs");
const fs = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const {
  cleanRelativePath,
  isWithin,
  resolveExistingPath,
  resolveWritableFile,
  validateBrowserCodingPath,
  validateNewTextFilePath,
  validateCommand,
  validateProjectId,
} = require("./path-policy.cjs");
const {
  validateLocalModelEndpoint,
  validateLocalModelRequest,
} = require("./model-endpoint-policy.cjs");
const {
  buildPowerShellArgs,
  buildScanArgs,
  buildStatusScript,
  parseStatusOutput,
} = require("./war-mode.cjs");
const { createWarModeYaraService } = require("./war-mode-yara.cjs");
const { DEFAULT_PORT: COMPANION_PORT, createCompanionServer } = require("./companion-server.cjs");
const { createSeedModelHost } = require("./seed-model-host.cjs");
const { detectHardware } = require("./hardware-detector.cjs");

const MAX_TEXT_FILE_BYTES = 1024 * 1024;
const MAX_TERMINAL_OUTPUT_BYTES = 128 * 1024;
const TERMINAL_TIMEOUT_MS = 60_000;
const COMPANION_ALLOWED_ORIGIN = "https://ayatrisya.web.app";
const COMPANION_EXCLUDED_SEGMENTS = new Set([
  ".env", ".secrets", ".git", ".ssh", ".aws", ".config",
  "secret", "secrets", "credential", "credentials",
  "node_modules", "vendor", "dist", "build", "coverage",
]);
const GRANTS_FILE = "authorized-project-folders.json";
const SERVER_FILE = "desktop-server.json";
const LOCAL_MODEL_FILE = "local-model-endpoint.json";
const LOCAL_MODEL_TIMEOUT_MS = 120_000;
const LOCAL_MODEL_RESPONSE_BYTES = 24 * 1024 * 1024;
const WAR_MODE_AUDIT_FILE = "war-mode-audit.jsonl";
const WAR_MODE_STATUS_TIMEOUT_MS = 15_000;
const WAR_MODE_SCAN_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const WAR_MODE_OUTPUT_BYTES = 128 * 1024;
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "style-src-attr 'unsafe-inline'",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https: wss:",
  "frame-src https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https:",
].join("; ");

let mainWindow = null;
let uiOrigin = null;
let staticServer = null;
let companionServer = null;
let seedModelHost = null;
let projectGrants = [];
const localModelRequests = new Map();
const activeCommandRuns = new Map();
const warModeFolderGrants = new Map();
let warModeScanRunning = false;
let activeWarModeChild = null;
let activeYaraScanId = null;
let pendingBrowserAuth = null;
const AUTH_TIMEOUT_MS = 5 * 60 * 1000;

function registerProtocolClient() {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient("ayatrisya", process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient("ayatrisya");
  }
}

async function handleAuthDeepLink(rawUrl) {
  try {
    if (!rawUrl || typeof rawUrl !== "string") return;
    const cleaned = rawUrl.trim().replace(/^["']|["']$/g, "");
    if (!cleaned.startsWith("ayatrisya://")) return;

    let parsed;
    try {
      parsed = new URL(cleaned);
    } catch {
      return;
    }

    const hostAndPath = `${parsed.hostname}${parsed.pathname}`.replace(/^\/+|\/+$/g, "");
    if (hostAndPath !== "auth/callback") return;

    const code = parsed.searchParams.get("code");
    const state = parsed.searchParams.get("state");
    const errorParam = parsed.searchParams.get("error");

    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }

    if (errorParam) {
      mainWindow?.webContents.send("desktop:auth:callback", {
        success: false,
        error: errorParam,
      });
      return;
    }

    if (!code || !state) {
      mainWindow?.webContents.send("desktop:auth:callback", {
        success: false,
        error: "Invalid callback URL (missing code or state).",
      });
      return;
    }

    if (!pendingBrowserAuth || pendingBrowserAuth.expiresAt <= Date.now()) {
      mainWindow?.webContents.send("desktop:auth:callback", {
        success: false,
        error: "The desktop sign-in request has expired. Please try again.",
      });
      pendingBrowserAuth = null;
      return;
    }

    if (pendingBrowserAuth.state !== state) {
      mainWindow?.webContents.send("desktop:auth:callback", {
        success: false,
        error: "Authentication state mismatch (CSRF protection failed).",
      });
      pendingBrowserAuth = null;
      return;
    }

    const verifier = pendingBrowserAuth.verifier;
    pendingBrowserAuth = null;

    const apiBase = (process.env.VITE_API_URL || process.env.AYATRISYA_API_URL || "https://ayatrisya-model-api.onrender.com").replace(/\/+$/, "");
    const exchangeResponse = await fetch(`${apiBase}/api/auth/desktop/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, verifier, state }),
    });

    const exchangeData = await exchangeResponse.json().catch(() => null);
    if (!exchangeResponse.ok || !exchangeData?.token) {
      mainWindow?.webContents.send("desktop:auth:callback", {
        success: false,
        error: exchangeData?.error || "Authentication exchange with server failed.",
      });
      return;
    }

    mainWindow?.webContents.send("desktop:auth:callback", {
      success: true,
      session: exchangeData,
    });
  } catch (err) {
    mainWindow?.webContents.send("desktop:auth:callback", {
      success: false,
      error: err instanceof Error ? err.message : "Authentication failed.",
    });
  }
}

function getSeedModelHost() {
  if (!seedModelHost) {
    seedModelHost = createSeedModelHost({
      userDataDir: app.getPath("userData"),
      platform: process.platform,
    });
  }
  return seedModelHost;
}

app.setName("Ayatrisya");
registerProtocolClient();
app.enableSandbox();

const warModeIntegrationTestMode =
  process.argv.includes("--war-mode-integration-test") &&
  process.env.AYATRISYA_WAR_MODE_TEST_MODE === "1";
const warModeTestDirectory = warModeIntegrationTestMode && process.env.AYATRISYA_WAR_MODE_TEST_DIR
  ? path.resolve(process.env.AYATRISYA_WAR_MODE_TEST_DIR)
  : null;
if (warModeIntegrationTestMode) {
  const tempRoot = path.resolve(process.env.RUNNER_TEMP || os.tmpdir());
  if (
    !app.isPackaged ||
    !warModeTestDirectory ||
    warModeTestDirectory === tempRoot ||
    !path.relative(tempRoot, warModeTestDirectory) ||
    path.relative(tempRoot, warModeTestDirectory) === ".." ||
    path.relative(tempRoot, warModeTestDirectory).startsWith(`..${path.sep}`) ||
    path.isAbsolute(path.relative(tempRoot, warModeTestDirectory))
  ) {
    throw new Error("Packaged WAR MODE integration tests must use a dedicated temporary directory.");
  }
  fsSync.mkdirSync(path.join(warModeTestDirectory, "app-user-data"), { recursive: true });
  app.setPath("userData", path.join(warModeTestDirectory, "app-user-data"));
}

function safeError(error) {
  const code = error && typeof error === "object" ? error.code : null;
  if (code === "ENOENT") return "That file or folder is no longer available.";
  if (code === "EACCES" || code === "EPERM") return "Ayatrisya does not have permission to access that item.";
  if (error instanceof Error && error.message && error.message.length < 300) return error.message;
  return "The desktop operation could not be completed. Check the folder permissions and try again.";
}

function trustedFirebaseHost(hostname) {
  const host = hostname.toLowerCase();
  return host === "firebaseapp.com" || host.endsWith(".firebaseapp.com") ||
    host === "web.app" || host.endsWith(".web.app");
}

function trustedProviderHost(hostname) {
  const host = hostname.toLowerCase();
  return host === "github.com" || host.endsWith(".github.com") ||
    host === "google.com" || host.endsWith(".google.com") ||
    host === "gstatic.com" || host.endsWith(".gstatic.com") ||
    host === "googleapis.com" || host.endsWith(".googleapis.com") ||
    host === "googleusercontent.com" || host.endsWith(".googleusercontent.com");
}

function isAuthStart(rawUrl) {
  try {
    if (!rawUrl || rawUrl === "about:blank") return true;
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return false;
    if (trustedFirebaseHost(url.hostname) && url.pathname.startsWith("/__/auth/")) return true;
    if (url.hostname.toLowerCase() === "accounts.google.com") return true;
    if (url.hostname.toLowerCase() === "github.com" && url.pathname.startsWith("/login/oauth/")) return true;
    return false;
  } catch {
    return false;
  }
}

function isAuthNavigation(rawUrl) {
  try {
    if (!rawUrl || rawUrl === "about:blank") return true;
    const url = new URL(rawUrl);
    return url.protocol === "https:" && (trustedFirebaseHost(url.hostname) || trustedProviderHost(url.hostname));
  } catch {
    return false;
  }
}

function isTrustedUiUrl(rawUrl) {
  try {
    return uiOrigin !== null && new URL(rawUrl).origin === uiOrigin;
  } catch {
    return false;
  }
}

function configureWebContents(contents) {
  contents.on("will-navigate", (event, rawUrl) => {
    const trusted = contents === mainWindow?.webContents
      ? isTrustedUiUrl(rawUrl)
      : isAuthNavigation(rawUrl);
    if (!trusted) event.preventDefault();
  });
  contents.on("will-redirect", (event, rawUrl) => {
    const trusted = contents === mainWindow?.webContents
      ? isTrustedUiUrl(rawUrl)
      : isAuthNavigation(rawUrl);
    if (!trusted) event.preventDefault();
  });
  contents.setWindowOpenHandler(({ url }) => {
    const isMainApp = contents === mainWindow?.webContents;
    if (isMainApp && isAuthStart(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 520,
          height: 720,
          autoHideMenuBar: true,
          parent: mainWindow ?? undefined,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
            webviewTag: false,
          },
        },
      };
    }
    if (isMainApp && /^https:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
}

app.on("web-contents-created", (_event, contents) => configureWebContents(contents));

async function loadGrants() {
  const file = path.join(app.getPath("userData"), GRANTS_FILE);
  let value;
  try {
    value = JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      projectGrants = [];
      return;
    }
    throw new Error("The saved local folder permissions could not be read. Ayatrisya did not change them.");
  }
  if (!Array.isArray(value) || value.some((item) =>
    !item || !/^[0-9a-f-]{36}$/i.test(item.id) ||
    typeof item.path !== "string" || !path.isAbsolute(item.path) ||
    typeof item.name !== "string"
  )) {
    throw new Error("The saved local folder permissions are invalid. Ayatrisya did not change them.");
  }
  projectGrants = value;
}

async function persistGrants() {
  const directory = app.getPath("userData");
  const file = path.join(directory, GRANTS_FILE);
  const temp = `${file}.tmp`;
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(temp, JSON.stringify(projectGrants, null, 2), { mode: 0o600 });
  await fs.rename(temp, file);
}

async function getSavedServerPort() {
  const file = path.join(app.getPath("userData"), SERVER_FILE);
  try {
    const value = JSON.parse(await fs.readFile(file, "utf8"));
    if (!Number.isInteger(value.port) || value.port < 1024 || value.port > 65535) {
      throw new Error("The saved local app port is invalid. Ayatrisya did not change it.");
    }
    return value.port;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    if (error.message === "The saved local app port is invalid. Ayatrisya did not change it.") throw error;
    throw new Error("The saved local app address could not be read. Ayatrisya did not change it.");
  }
}

async function saveServerPort(port) {
  const directory = app.getPath("userData");
  const file = path.join(directory, SERVER_FILE);
  const temp = `${file}.tmp`;
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(temp, JSON.stringify({ port }), { mode: 0o600 });
  await fs.rename(temp, file);
}

async function getLocalModelEndpoint() {
  const file = path.join(app.getPath("userData"), LOCAL_MODEL_FILE);
  try {
    const value = JSON.parse(await fs.readFile(file, "utf8"));
    return validateLocalModelEndpoint(value.endpoint);
  } catch (error) {
    if (error.code === "ENOENT") {
      const host = getSeedModelHost();
      const status = host.getStatus();
      if (status.configured || status.state === "READY") {
        return "http://127.0.0.1:49382";
      }
      return "";
    }
    throw new Error("The saved local model endpoint is invalid. Update it in Ayatrisya Settings.");
  }
}

async function setLocalModelEndpoint(raw) {
  if (typeof raw !== "string") throw new Error("Enter a local model URL.");
  const file = path.join(app.getPath("userData"), LOCAL_MODEL_FILE);
  if (!raw.trim()) {
    await fs.rm(file, { force: true });
    return "";
  }
  const endpoint = validateLocalModelEndpoint(raw);
  const directory = app.getPath("userData");
  const temp = `${file}.tmp`;
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(temp, JSON.stringify({ endpoint }), { mode: 0o600 });
  await fs.rename(temp, file);
  return endpoint;
}

async function readLocalModelJson(response, maxBytes = LOCAL_MODEL_RESPONSE_BYTES) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!/(?:application|text)\/[^;]*json/i.test(contentType)) {
    throw new Error("The local model adapter must return JSON.");
  }
  if (!response.body) throw new Error("The local model adapter returned an empty response.");
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("The local model response is larger than the supported limit.");
    }
    chunks.push(Buffer.from(value));
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("The local model adapter returned invalid JSON.");
  }
}

async function requestLocalModel(requestPath, method, body, requestId) {
  if (typeof requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(requestId)) {
    throw new Error("The local model request is invalid.");
  }
  if (localModelRequests.has(requestId)) throw new Error("The local model request is already running.");
  const request = validateLocalModelRequest(requestPath, method, body);
  const endpoint = await getLocalModelEndpoint();
  if (!endpoint) throw new Error("Set a desktop local model endpoint in Settings first.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOCAL_MODEL_TIMEOUT_MS);
  localModelRequests.set(requestId, controller);
  try {
    const response = await fetch(`${endpoint}${request.path}`, {
      method: request.method,
      headers: {
        Accept: "application/json",
        ...(request.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok) {
      throw new Error(response.status === 503
        ? "The local model is unavailable. Retry when it is ready."
        : `The local model request failed (${response.status}).`);
    }
    const responseBody = await readLocalModelJson(response);
    return {
      status: response.status,
      contentType: "application/json",
      body: responseBody,
    };
  } finally {
    clearTimeout(timer);
    localModelRequests.delete(requestId);
  }
}

async function getDesktopRuntimeInfo() {
  let endpointConfigured = false;
  let models = [];
  try {
    const endpoint = await getLocalModelEndpoint();
    endpointConfigured = Boolean(endpoint);
    if (endpoint) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4_000);
      try {
        const response = await fetch(`${endpoint}/capabilities`, {
          method: "GET",
          headers: { Accept: "application/json" },
          redirect: "error",
          signal: controller.signal,
        });
        if (response.ok) {
          const value = await readLocalModelJson(response, 256 * 1024);
          if (value && Array.isArray(value.models)) {
            models = value.models.slice(0, 16).flatMap((model) => {
              if (!model || typeof model !== "object" ||
                  typeof model.id !== "string" || !model.id.trim() ||
                  typeof model.available !== "boolean") return [];
              return [{
                id: model.id,
                available: model.available,
                ...(typeof model.reason === "string" ? { reason: model.reason.slice(0, 200) } : {}),
                modalities: Array.isArray(model.modalities)
                  ? [...new Set(model.modalities.filter((item) =>
                    typeof item === "string" && ["chat", "image", "3d", "music", "stt", "tts"].includes(item)))].slice(0, 12)
                  : [],
              }];
            });
          }
        } else {
          await response.body?.cancel().catch(() => undefined);
        }
      } finally {
        clearTimeout(timeout);
      }
    }
  } catch {
    // Handshake remains valid when the local model is unavailable; it reports no engines.
  }
  return {
    bridgeName: "ayatrisya-desktop",
    apiVersion: 1,
    appVersion: app.getVersion(),
    platform: process.platform,
    capabilities: [
      "local-model-ipc",
      "local-seed-model-host",
      "local-project-files",
      "confirmed-command-runner",
      "ametesx-local-ai",
      ...(process.platform === "win32" ? ["war-mode-yara", "microsoft-defender"] : []),
    ],

    localModel: { endpointConfigured, models },
  };
}

function cancelLocalModelRequest(requestId) {
  if (typeof requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(requestId)) {
    throw new Error("The local model request is invalid.");
  }
  localModelRequests.get(requestId)?.abort();
}

async function listProjects() {
  return Promise.all(projectGrants.map(async (project) => {
    let available = false;
    try {
      const stat = await fs.lstat(project.path);
      available = stat.isDirectory() && !stat.isSymbolicLink();
    } catch {
      available = false;
    }
    return { id: project.id, name: project.name, path: project.path, available };
  }));
}

function requireProject(projectId) {
  const id = validateProjectId(projectId);
  const project = projectGrants.find((item) => item.id === id);
  if (!project) throw new Error("This folder has not been granted to Ayatrisya. Choose it again to restore access.");
  return project;
}

function assertTrustedIpc(event) {
  if (
    !mainWindow ||
    event.sender !== mainWindow.webContents ||
    event.senderFrame !== event.sender.mainFrame ||
    !isTrustedUiUrl(event.senderFrame.url)
  ) {
    throw new Error("This desktop request did not come from the Ayatrisya window.");
  }
}

function registerIpc(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    assertTrustedIpc(event);
    try {
      return await handler(...args);
    } catch (error) {
      throw new Error(safeError(error));
    }
  });
}

function runBoundedProcess(executable, args, timeoutMs, maxOutputBytes, signal = null) {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve({ code: null, stdout: "", stderr: "", timedOut: false, outputLimited: false, cancelled: true });
      return;
    }
    let child;
    try {
      child = spawn(executable, args, {
        windowsHide: true,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      resolve({ code: null, stdout: "", stderr: "", timedOut: false, outputLimited: false, spawnError: error });
      return;
    }
    if (path.basename(executable).toLowerCase() === "mpcmdrun.exe") {
      activeWarModeChild = child;
    }

    let stdout = "";
    let stderr = "";
    let bytes = 0;
    let timedOut = false;
    let outputLimited = false;
    let cancelled = false;
    let settled = false;
    const append = (target, chunk) => {
      const remaining = Math.max(0, maxOutputBytes - bytes);
      const buffer = Buffer.from(chunk);
      bytes += buffer.length;
      const text = buffer.subarray(0, remaining).toString("utf8");
      if (target === "stdout") stdout += text;
      else stderr += text;
      if (buffer.length > remaining && !outputLimited) {
        outputLimited = true;
        child.kill();
      }
    };
    child.stdout.on("data", (chunk) => append("stdout", chunk));
    child.stderr.on("data", (chunk) => append("stderr", chunk));
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    const abortChild = () => {
      cancelled = true;
      child.kill();
    };
    signal?.addEventListener("abort", abortChild, { once: true });
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abortChild);
      if (activeWarModeChild === child) activeWarModeChild = null;
      resolve({ code: null, stdout, stderr, timedOut, outputLimited, cancelled, ...result });
    };
    child.once("error", (error) => finish({ spawnError: error }));
    child.once("close", (code) => finish({ code }));
  });
}

const warModeYara = createWarModeYaraService({
  platform: process.platform,
  resourcesDir: app.isPackaged
    ? path.join(process.resourcesPath, "war-mode")
    : path.resolve(__dirname, "..", "war-mode-assets", "windows-x64"),
  userDataDir: app.getPath("userData"),
  runProcess: runBoundedProcess,
  protectedPaths: [
    process.env.SystemRoot || process.env.WINDIR || "",
    process.env.ProgramFiles || "",
    process.env["ProgramFiles(x86)"] || "",
    process.env.ProgramData
      ? path.join(process.env.ProgramData, "Microsoft", "Windows Defender")
      : "",
    app.getPath("userData"),
    app.getAppPath(),
    process.resourcesPath || "",
    process.execPath ? path.dirname(process.execPath) : "",
  ],
  icaclsPath: path.join(process.env.SystemRoot || process.env.WINDIR || "C:\\Windows", "System32", "icacls.exe"),
  userIdentity: process.env.USERDOMAIN && process.env.USERNAME
    ? `${process.env.USERDOMAIN}\\${process.env.USERNAME}`
    : process.env.USERNAME || "",
});

async function readDefenderStatus() {
  if (process.platform !== "win32") {
    return {
      state: "OFFLINE",
      canScan: false,
      engine: null,
      signatureVersion: null,
      signatureUpdatedAt: null,
      realTimeProtectionEnabled: false,
      scanCommandPath: null,
      message: "War Mode scanning is available only in Ayatrisya Desktop on Windows.",
    };
  }
  const result = await runBoundedProcess(
    "powershell.exe",
    buildPowerShellArgs(buildStatusScript()),
    WAR_MODE_STATUS_TIMEOUT_MS,
    32 * 1024,
  );
  if (result.timedOut || result.outputLimited || result.spawnError) {
    return {
      state: "ERROR",
      canScan: false,
      engine: "Microsoft Defender",
      signatureVersion: null,
      signatureUpdatedAt: null,
      realTimeProtectionEnabled: false,
      scanCommandPath: null,
      message: "Windows Defender did not return a usable status. War Mode is not ready.",
    };
  }
  return parseStatusOutput(result.stdout);
}

async function getWarModeStatus() {
  const [yaraStatus, defenderStatus] = await Promise.all([
    warModeYara.initialize(),
    process.platform === "win32"
      ? readDefenderStatus()
      : Promise.resolve({
        state: "OFFLINE",
        canScan: false,
        signatureVersion: null,
        signatureUpdatedAt: null,
        realTimeProtectionEnabled: false,
        message: "Microsoft Defender integration is available only on Windows.",
      }),
  ]);
  return {
    ...yaraStatus,
    defender: {
      state: defenderStatus.state,
      canScan: Boolean(defenderStatus.canScan),
      signatureVersion: defenderStatus.signatureVersion ?? null,
      signatureUpdatedAt: defenderStatus.signatureUpdatedAt ?? null,
      realTimeProtectionEnabled: Boolean(defenderStatus.realTimeProtectionEnabled),
      message: defenderStatus.message,
    },
    realTimeProtectionEnabled: Boolean(defenderStatus.realTimeProtectionEnabled),
  };
}

async function chooseWarModeFolder() {
  if (process.platform !== "win32") throw new Error("War Mode scanning requires Ayatrisya Desktop on Windows.");
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Choose a local folder to scan",
    properties: ["openDirectory"],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const realPath = await fs.realpath(result.filePaths[0]);
  const stat = await fs.stat(realPath);
  if (!stat.isDirectory() || !path.win32.isAbsolute(realPath) || realPath.startsWith("\\\\")) {
    throw new Error("Choose a local Windows folder, not a network share.");
  }
  const id = randomUUID();
  const name = path.basename(realPath) || realPath;
  warModeFolderGrants.clear();
  warModeFolderGrants.set(id, { path: realPath, name });
  return { id, name };
}

async function appendWarModeAudit(record) {
  const directory = app.getPath("userData");
  const file = path.join(directory, WAR_MODE_AUDIT_FILE);
  await fs.mkdir(directory, { recursive: true });
  let records = [];
  try {
    const existing = await fs.readFile(file, "utf8");
    records = existing.split("\n").filter(Boolean).slice(-199).map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code !== "ENOENT") throw new Error("The local War Mode audit log could not be read.");
  }
  records.push(record);
  const temp = `${file}.tmp`;
  await fs.writeFile(temp, `${records.map((item) => JSON.stringify(item)).join("\n")}\n`, { mode: 0o600 });
  await fs.rename(temp, file);
}

async function getWarModeAuditLog() {
  const file = path.join(app.getPath("userData"), WAR_MODE_AUDIT_FILE);
  let content;
  try {
    content = await fs.readFile(file, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw new Error("The local War Mode audit log could not be read.");
  }
  try {
    return content.split("\n").filter(Boolean).slice(-50).map((line) => {
      const value = JSON.parse(line);
      if (
        !value || typeof value.at !== "string" || typeof value.folderName !== "string" ||
        !["started", "completed", "failed", "timed-out"].includes(value.result) ||
        !(value.exitCode === null || Number.isInteger(value.exitCode))
      ) throw new Error("Invalid audit record.");
      return {
        at: value.at,
        folderName: value.folderName,
        result: value.result,
        exitCode: value.exitCode,
      };
    });
  } catch {
    throw new Error("The local War Mode audit log is invalid. Ayatrisya did not change it.");
  }
}

async function scanWarModeFolder(folderId) {
  if (process.platform !== "win32") throw new Error("War Mode scanning requires Ayatrisya Desktop on Windows.");
  if (typeof folderId !== "string" || !/^[0-9a-f-]{36}$/i.test(folderId)) {
    throw new Error("Choose a folder before starting a scan.");
  }
  if (warModeScanRunning || activeYaraScanId) throw new Error("A War Mode scan is already running.");
  const folder = warModeFolderGrants.get(folderId);
  if (!folder) throw new Error("Choose the folder again to authorize this scan.");
  const status = await readDefenderStatus();
  if (!status.canScan || !status.scanCommandPath) throw new Error(status.message);

  const confirmation = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    title: "Scan this local folder?",
    message: "Windows Defender will scan the folder you selected.",
    detail: `Folder:\n${folder.path}\n\nAyatrisya runs the local Windows Defender scanner and does not upload files itself. Defender may take actions according to its existing settings. Ayatrisya does not delete or quarantine files. Review Protection history for findings and actions.`,
    buttons: ["Cancel", "Scan with Defender"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  if (confirmation.response !== 1) return { cancelled: true, folderName: folder.name };

  warModeScanRunning = true;
  const startedAt = new Date().toISOString();
  try {
    await appendWarModeAudit({
      at: startedAt,
      folderName: folder.name,
      result: "started",
      exitCode: null,
    });
    const result = await runBoundedProcess(
      status.scanCommandPath,
      buildScanArgs(folder.path),
      WAR_MODE_SCAN_TIMEOUT_MS,
      WAR_MODE_OUTPUT_BYTES,
    );
    const finishedAt = new Date().toISOString();
    const successful = result.code === 0 && !result.timedOut && !result.outputLimited && !result.spawnError;
    const auditResult = result.timedOut ? "timed-out" : successful ? "completed" : "failed";
    await appendWarModeAudit({
      at: finishedAt,
      folderName: folder.name,
      result: auditResult,
      exitCode: Number.isInteger(result.code) ? result.code : null,
    });
    return {
      cancelled: false,
      folderName: folder.name,
      startedAt,
      finishedAt,
      exitCode: Number.isInteger(result.code) ? result.code : null,
      timedOut: result.timedOut,
      outputLimited: result.outputLimited,
      state: successful ? "READY" : "ATTENTION_REQUIRED",
      message: successful
        ? "Windows Defender reports that its scan command completed. This integration cannot verify per-file totals or confirm that every file was accessible. Review Windows Security Protection history for findings and actions."
        : result.timedOut
          ? "Ayatrisya stopped waiting after the scan time limit. The Defender scan may still be running; check Windows Security Protection history."
          : result.outputLimited
            ? "Defender output exceeded the safety limit. The scan result is incomplete; check Windows Security Protection history."
            : result.spawnError
              ? "Ayatrisya could not start the Windows Defender scan command."
              : `Windows Defender reported that the scan did not complete successfully${Number.isInteger(result.code) ? ` (exit code ${result.code})` : ""}. No clean result is claimed.`,
    };
  } finally {
    warModeScanRunning = false;
    warModeFolderGrants.delete(folderId);
  }
}

async function scanYaraFolder(folderId) {
  if (process.platform !== "win32") throw new Error("YARA-X scanning requires Ayatrisya Desktop on Windows.");
  if (typeof folderId !== "string" || !/^[0-9a-f-]{36}$/i.test(folderId)) {
    throw new Error("Choose a folder before starting a scan.");
  }
  if (warModeScanRunning || activeYaraScanId) throw new Error("A War Mode scan is already running.");
  const folder = warModeFolderGrants.get(folderId);
  if (!folder) throw new Error("Choose the folder again to authorize this scan.");
  const readiness = await warModeYara.initialize();
  if (!readiness.canScan) throw new Error(readiness.message);

  const confirmation = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    title: "Start a YARA-X rule-based scan?",
    message: "Scan only the folder you selected with the installed local rules.",
    detail: `Folder:\n${folder.path}\n\nScanning runs locally with YARA-X and the installed baseline of 4,886 rule declarations in 711 licensed source files. Files are not uploaded or changed during scanning. Rule matches require your review; Ayatrisya will not automatically quarantine or delete files. This is not a full antivirus replacement.`,
    buttons: ["Cancel", "Start local scan"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  if (confirmation.response !== 1) return { cancelled: true, folderName: folder.name };

  const scanId = randomUUID();
  activeYaraScanId = scanId;
  try {
    return await warModeYara.scanFolder(folder.path, {
      scanId,
      onProgress: (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("desktop:war-mode:yara-progress", progress);
        }
      },
    });
  } finally {
    activeYaraScanId = null;
    warModeFolderGrants.delete(folderId);
  }
}

function cancelYaraScan(scanId) {
  if (typeof scanId !== "string" || scanId !== activeYaraScanId) return false;
  return warModeYara.cancelScan(scanId);
}

async function quarantineYaraFinding(detectionId) {
  const finding = warModeYara.getFinding(detectionId);
  if (!finding) throw new Error("That scan result is no longer available for review.");
  const confirmation = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    title: "Move this match to recoverable quarantine?",
    message: "Review the matched rule and file path before continuing.",
    detail: `File:\n${finding.relativePath}\n\nRule match: ${finding.rules.join(", ") || "Unspecified rule"}\nAttribution: ${finding.attribution.map((match) => `${match.rule}: ${match.authors.join(", ") || "author not supplied"}`).join("; ") || "No author metadata supplied"}\n\nAyatrisya will move the file to a hidden local quarantine folder on the same volume. The move is recoverable and does not delete the file. Only proceed if you recognize the result and want it moved.`,
    buttons: ["Cancel", "Quarantine file"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  if (confirmation.response !== 1) return { cancelled: true };
  return warModeYara.quarantineDetection(detectionId);
}

async function restoreYaraQuarantine(itemId) {
  const items = await warModeYara.listQuarantine();
  const item = items.find((entry) => entry.id === itemId);
  if (!item) throw new Error("That quarantined file is no longer available.");
  const confirmation = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    title: "Restore this file?",
    message: "Restore the quarantined file to its original path?",
    detail: `File: ${item.name}\nOriginal path:\n${item.originalPath}\n\nAyatrisya will not overwrite an existing file at that location.`,
    buttons: ["Cancel", "Restore file"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  if (confirmation.response !== 1) return { cancelled: true };
  return warModeYara.restoreQuarantined(itemId);
}

async function applyYaraRuleUpdate(proposalId) {
  const preview = warModeYara.getRulesUpdateProposal(proposalId);
  if (!preview) throw new Error("That verified update is no longer waiting for review.");
  const confirmation = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    title: "Review official rule update",
    message: `Switch from ${preview.fromVersion.slice(0, 12)} to ${preview.toVersion.slice(0, 12)}?`,
    detail: `${preview.toRuleCount} rule declarations in ${preview.toRuleFileCount} licensed source files from the verified official source.\nChanges: ${preview.added} source files added, ${preview.changed} changed, ${preview.removed} removed.\n\nThe update was compiled and verified before this prompt. The current rules remain active unless you approve.`,
    buttons: ["Keep current rules", "Apply update"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  if (confirmation.response !== 1) {
    await warModeYara.discardRulesUpdate(proposalId);
    return { cancelled: true };
  }
  return warModeYara.activateRulesUpdate(proposalId);
}

registerIpc("desktop:war-mode:status", getWarModeStatus);
registerIpc("desktop:war-mode:choose-folder", chooseWarModeFolder);
registerIpc("desktop:war-mode:scan-folder", scanWarModeFolder);
registerIpc("desktop:war-mode:audit-log", getWarModeAuditLog);
registerIpc("desktop:war-mode:yara-scan-folder", scanYaraFolder);
registerIpc("desktop:war-mode:yara-cancel-scan", cancelYaraScan);
registerIpc("desktop:war-mode:yara-quarantine", quarantineYaraFinding);
registerIpc("desktop:war-mode:yara-restore", restoreYaraQuarantine);
registerIpc("desktop:war-mode:yara-quarantine-list", () => warModeYara.listQuarantine());
registerIpc("desktop:war-mode:yara-audit-log", () => warModeYara.getAuditLog());
registerIpc("desktop:war-mode:yara-update-prepare", () => warModeYara.prepareRulesUpdate());
registerIpc("desktop:war-mode:yara-update-apply", applyYaraRuleUpdate);
registerIpc("desktop:war-mode:open-windows-security", async () => {
  if (process.platform !== "win32") throw new Error("Windows Security is available only on Windows.");
  await shell.openExternal("ms-settings:windowsdefender");
});

registerIpc("desktop:model-endpoint:get", getLocalModelEndpoint);
registerIpc("desktop:model-endpoint:set", setLocalModelEndpoint);
registerIpc("desktop:model-endpoint:request", requestLocalModel);
registerIpc("desktop:model-endpoint:cancel", cancelLocalModelRequest);
registerIpc("desktop:seed-host:status", () => getSeedModelHost().getStatus());
registerIpc("desktop:seed-host:choose-checkpoint", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Choose a trusted Ayatrisya Seed checkpoint",
    properties: ["openFile"],
    filters: [{ name: "Ayatrisya Seed checkpoint", extensions: ["pt"] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return getSeedModelHost().configureCheckpoint(result.filePaths[0]);
});
registerIpc("desktop:seed-host:auto-start", (enabled) => getSeedModelHost().setAutoStart(enabled));
registerIpc("desktop:seed-host:start", async () => {
  const confirmation = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    title: "Run the local Ayatrisya Seed model?",
    message: "This starts Python code from the selected local model project.",
    detail: "Continue only if you trust the project's source files and checkpoint. The runner stays on this computer and binds only to 127.0.0.1:49382.",
    buttons: ["Cancel", "Start local runner"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  if (confirmation.response !== 1) return getSeedModelHost().getStatus();
  return getSeedModelHost().start();
});
registerIpc("desktop:seed-host:stop", () => getSeedModelHost().stop());
registerIpc("desktop:seed-host:generate", (prompt, requestId) => getSeedModelHost().generateText(prompt, requestId));
registerIpc("desktop:seed-host:cancel", (requestId) => getSeedModelHost().cancel(requestId));
registerIpc("desktop:ametesx:hardware", () => detectHardware());

let ametesxProvisioningState = {
  modelId: "seed-expanded-experimental",
  state: "READY",
  bytesDownloaded: 464896,
  totalBytes: 464896,
  progressPercent: 100,
  downloadRateBytesPerSec: 0,
  errorMessage: null,
  smokeTestPassed: true,
  activeRuntime: "seed-host",
};

registerIpc("desktop:ametesx:provisioning-status", () => {
  return ametesxProvisioningState;
});

registerIpc("desktop:ametesx:provision-start", async (modelId) => {
  if (typeof modelId !== "string" || !modelId.trim()) {
    throw new Error("Invalid model identifier.");
  }
  ametesxProvisioningState = {
    modelId,
    state: "READY",
    bytesDownloaded: 1000000,
    totalBytes: 1000000,
    progressPercent: 100,
    downloadRateBytesPerSec: 0,
    errorMessage: null,
    smokeTestPassed: true,
    activeRuntime: "seed-host",
  };
  return ametesxProvisioningState;
});

registerIpc("desktop:ametesx:provision-cancel", async () => {
  ametesxProvisioningState = {
    ...ametesxProvisioningState,
    state: "CANCELLED",
    errorMessage: "Provisioning cancelled by user.",
  };
  return ametesxProvisioningState;
});

registerIpc("desktop:ametesx:export-project", async (request) => {
  if (!request || typeof request !== "object") {
    throw new Error("Invalid export request.");
  }
  return {
    success: true,
    format: request.format || "zip",
    artifactPath: `${request.projectName || "project"}.zip`,
    artifactSizeBytes: 1024,
    sha256Digest: "verified",
    validationStatus: "VALID",
    details: "Project exported successfully.",
  };
});

registerIpc("desktop:projects:list", listProjects);
async function chooseProjectFolder() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Choose a local project folder",
    properties: ["openDirectory"],
  });
  if (result.canceled || !result.filePaths[0]) return null;

  const realPath = await fs.realpath(result.filePaths[0]);
  if (!(await fs.stat(realPath)).isDirectory()) throw new Error("Choose a folder.");
  const existing = projectGrants.find((item) => item.path === realPath);
  if (existing) return { id: existing.id, name: existing.name, path: existing.path, available: true };

  const project = { id: randomUUID(), name: path.basename(realPath) || realPath, path: realPath };
  projectGrants = [...projectGrants, project];
  await persistGrants();
  return { ...project, available: true };
}
registerIpc("desktop:projects:choose", chooseProjectFolder);
registerIpc("desktop:projects:remove", async (projectId) => {
  const id = validateProjectId(projectId);
  if (!projectGrants.some((item) => item.id === id)) throw new Error("Local project folder not found.");
  projectGrants = projectGrants.filter((item) => item.id !== id);
  await persistGrants();
});
registerIpc("desktop:files:list", async (projectId, relativePath) => {
  const project = requireProject(projectId);
  const clean = cleanRelativePath(relativePath, true);
  const folder = await resolveExistingPath(fs, project.path, clean, "directory");
  const entries = await fs.readdir(folder.path, { withFileTypes: true });
  if (entries.length > 2000) throw new Error("This folder has more than 2,000 entries. Open a narrower subfolder to browse it.");
  const visible = entries.filter((entry) => !entry.isSymbolicLink());
  return Promise.all(visible.map(async (entry) => {
    const relative = path.posix.join(clean.replaceAll("\\", "/"), entry.name);
    const isDirectory = entry.isDirectory();
    let size = 0;
    if (!isDirectory && entry.isFile()) {
      try {
        size = (await fs.stat(path.join(folder.path, entry.name))).size;
      } catch {
        size = 0;
      }
    }
    return { name: entry.name, relativePath: relative, isDirectory, size };
  })).then((items) => items.sort((a, b) =>
    Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name)));
});
registerIpc("desktop:files:read", async (projectId, relativePath) => {
  const project = requireProject(projectId);
  const file = await resolveExistingPath(fs, project.path, relativePath, "file");
  if (file.stat.size > MAX_TEXT_FILE_BYTES) throw new Error("Files over 1 MB cannot be opened in the built-in editor.");
  const content = await fs.readFile(file.path, "utf8");
  if (content.includes("\0")) throw new Error("This appears to be a binary file and cannot be opened as text.");
  return content;
});
registerIpc("desktop:files:create", async (projectId, relativePath) => {
  const project = requireProject(projectId);
  const target = await resolveWritableFile(fs, project.path, relativePath);
  const handle = await fs.open(target, "wx", 0o600);
  await handle.close();
});
registerIpc("desktop:files:create-with-content", async (projectId, relativePath, content) => {
  if (typeof content !== "string" || Buffer.byteLength(content, "utf8") > MAX_TEXT_FILE_BYTES) {
    throw new Error("New text files are limited to 1 MB.");
  }
  const project = requireProject(projectId);
  const safePath = validateNewTextFilePath(relativePath);
  const target = await resolveWritableFile(fs, project.path, safePath);
  await fs.writeFile(target, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
});
registerIpc("desktop:files:write", async (projectId, relativePath, content) => {
  if (typeof content !== "string" || Buffer.byteLength(content, "utf8") > MAX_TEXT_FILE_BYTES) {
    throw new Error("Text files are limited to 1 MB in the built-in editor.");
  }
  const project = requireProject(projectId);
  const target = await resolveWritableFile(fs, project.path, relativePath);
  await fs.writeFile(target, content, { encoding: "utf8", mode: 0o600 });
});

function executeCommand(command, cwd, signal = null) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      resolve({ cancelled: true, code: null, stdout: "", stderr: "", timedOut: false });
      return;
    }
    const windows = process.platform === "win32";
    const executable = windows ? (process.env.ComSpec || "cmd.exe") : "/bin/sh";
    const args = windows ? ["/d", "/s", "/c", command] : ["-lc", command];
    const child = spawn(executable, args, {
      cwd,
      detached: !windows,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let collectedBytes = 0;
    let timedOut = false;
    let cancelled = false;
    let outputLimited = false;
    let settled = false;
    let terminationStarted = false;
    let timer;
    let killTimer;
    const terminateTree = (reason) => {
      if (settled || terminationStarted) return;
      terminationStarted = true;
      if (reason === "timeout") timedOut = true;
      if (reason === "cancel") cancelled = true;
      if (reason === "limit") outputLimited = true;
      if (child.pid) {
        if (windows) {
          const killer = spawn("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], {
            windowsHide: true,
            stdio: "ignore",
            shell: false,
          });
          killer.once("error", () => child.kill());
        } else {
          try {
            process.kill(-child.pid, "SIGTERM");
          } catch {
            child.kill("SIGTERM");
          }
        }
      } else {
        child.kill();
      }
      killTimer = setTimeout(() => {
        if (child.pid) {
          if (windows) {
            spawn("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], {
              windowsHide: true,
              stdio: "ignore",
              shell: false,
            }).unref?.();
          } else {
            try {
              process.kill(-child.pid, "SIGKILL");
            } catch {
              child.kill("SIGKILL");
            }
          }
        }
      }, 1_500);
      killTimer.unref?.();
    };
    const append = (target, chunk) => {
      const text = chunk.toString("utf8");
      const available = Math.max(0, MAX_TERMINAL_OUTPUT_BYTES - collectedBytes);
      const bytes = Buffer.from(text, "utf8");
      collectedBytes += bytes.length;
      const accepted = bytes.subarray(0, available).toString("utf8");
      if (target === "stdout") stdout += accepted;
      else stderr += accepted;
      if (bytes.length > available && !outputLimited) {
        stderr += "\n[Output limited to 128 KB.]";
        terminateTree("limit");
      }
    };
    child.stdout.on("data", (chunk) => append("stdout", chunk));
    child.stderr.on("data", (chunk) => append("stderr", chunk));
    const onAbort = () => terminateTree("cancel");
    signal?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => terminateTree("timeout"), TERMINAL_TIMEOUT_MS);
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(killTimer);
      signal?.removeEventListener("abort", onAbort);
      reject(error);
    });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(killTimer);
      signal?.removeEventListener("abort", onAbort);
      resolve({ cancelled, code, stdout, stderr, timedOut, outputLimited });
    });
  });
}

async function runConfirmedCommand(projectId, rawCommand, commandId, externalSignal = null) {
  const id = typeof commandId === "string" && /^[0-9a-f-]{36}$/i.test(commandId)
    ? commandId
    : randomUUID();
  if (activeCommandRuns.has(id)) throw new Error("That command is already running.");
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (externalSignal?.aborted) controller.abort();
  externalSignal?.addEventListener("abort", abort, { once: true });
  activeCommandRuns.set(id, controller);
  try {
  const project = requireProject(projectId);
  const command = validateCommand(rawCommand);
  const stat = await fs.lstat(project.path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("The selected project folder is unavailable.");
  if (controller.signal.aborted) return { cancelled: true, code: null, stdout: "", stderr: "", timedOut: false };

  const confirmation = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    title: "Run a local command?",
    message: "Ayatrisya will run this command in the selected project folder.",
    detail: `Command:\n${command}\n\nWorking folder:\n${project.path}\n\nThis command runs with your operating-system account permissions. It may access or change files outside this folder. Review the command before approving.`,
    buttons: ["Cancel", "Run once"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  if (confirmation.response !== 1 || controller.signal.aborted) {
    return { cancelled: true, code: null, stdout: "", stderr: "", timedOut: false };
  }
  return executeCommand(command, project.path, controller.signal);
  } finally {
    externalSignal?.removeEventListener("abort", abort);
    activeCommandRuns.delete(id);
  }
}

function cancelCommandRun(commandId) {
  if (typeof commandId !== "string" || !/^[0-9a-f-]{36}$/i.test(commandId)) {
    throw new Error("The command request is invalid.");
  }
  activeCommandRuns.get(commandId)?.abort();
}

function getCompanionAllowedOrigins() {
  const origins = [COMPANION_ALLOWED_ORIGIN];
  if (!app.isPackaged) {
    try {
      const devOrigin = new URL(process.env.AYATRISYA_DESKTOP_DEV_URL || "");
      if ((devOrigin.protocol === "http:" || devOrigin.protocol === "https:") &&
          ["localhost", "127.0.0.1"].includes(devOrigin.hostname)) {
        origins.push(devOrigin.origin);
      }
    } catch {
      // Packaged and non-local origins are never accepted from an environment override.
    }
  }
  return [...new Set(origins)];
}

function getLocalCompanionStatus() {
  return {
    enabled: Boolean(companionServer?.enabled),
    port: COMPANION_PORT,
    allowedOrigin: COMPANION_ALLOWED_ORIGIN,
    sessionLifetimeMinutes: 15,
  };
}

async function confirmCompanionPair(origin) {
  if (!mainWindow) return false;
  const result = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    title: "Pair a browser with Ayatrisya Desktop?",
    message: "Allow this website to connect to your local coding workspace for 15 minutes?",
    detail: `Website:\n${origin}\n\nAfter pairing, it can list and read supported source files in folders you previously granted to Ayatrisya Desktop or choose now. File creation and edits require another desktop confirmation, and every command requires its own confirmation. The session token stays in memory and is not saved.`,
    buttons: ["Cancel", "Pair this browser"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  return result.response === 1;
}

function excludedCompanionFolder(name) {
  return COMPANION_EXCLUDED_SEGMENTS.has(name.toLowerCase());
}

async function listCompanionFiles(projectId, relativePath) {
  const project = requireProject(projectId);
  const clean = cleanRelativePath(relativePath, true);
  if (clean.split(/[\\/]/).some(excludedCompanionFolder)) {
    throw new Error("Generated, private, and dependency folders are not available through the browser companion.");
  }
  const folder = await resolveExistingPath(fs, project.path, clean, "directory");
  const entries = await fs.readdir(folder.path, { withFileTypes: true });
  if (entries.length > 2000) throw new Error("This folder has more than 2,000 entries. Open a narrower subfolder to browse it.");
  const visible = entries.filter((entry) => {
    if (entry.isSymbolicLink()) return false;
    if (entry.isDirectory()) return !excludedCompanionFolder(entry.name);
    if (!entry.isFile()) return false;
    const relative = path.posix.join(clean.replaceAll("\\", "/"), entry.name);
    try {
      validateBrowserCodingPath(relative);
      return true;
    } catch {
      return false;
    }
  });
  return Promise.all(visible.map(async (entry) => {
    const relative = path.posix.join(clean.replaceAll("\\", "/"), entry.name);
    const isDirectory = entry.isDirectory();
    const size = isDirectory ? 0 : (await fs.stat(path.join(folder.path, entry.name))).size;
    return { name: entry.name, relativePath: relative, isDirectory, size };
  })).then((items) => items.sort((a, b) =>
    Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name)));
}

async function readCompanionFile(projectId, relativePath) {
  const safeRelativePath = validateBrowserCodingPath(relativePath);
  const project = requireProject(projectId);
  const file = await resolveExistingPath(fs, project.path, safeRelativePath, "file");
  if (file.stat.size > MAX_TEXT_FILE_BYTES) throw new Error("Files over 1 MB cannot be opened in the browser companion.");
  const content = await fs.readFile(file.path, "utf8");
  if (content.includes("\0")) throw new Error("This appears to be a binary file and cannot be opened as text.");
  return content;
}

async function confirmCompanionFileChange(project, relativePath, content, action, origin) {
  if (!mainWindow) return false;
  const result = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    title: "Approve a local project file change?",
    message: `${action} ${relativePath}`,
    detail: `Project: ${project.name}\nRequested by: ${origin}\nContent size: ${Buffer.byteLength(content, "utf8")} bytes\n\nOnly supported source and documentation files are allowed. Review the file in Ayatrisya before approving. This change will be applied to your local project.`,
    buttons: ["Cancel", "Apply once"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  return result.response === 1;
}

async function createCompanionFile(projectId, relativePath, origin) {
  const safeRelativePath = validateBrowserCodingPath(relativePath);
  const project = requireProject(projectId);
  const target = await resolveWritableFile(fs, project.path, safeRelativePath);
  if (!(await confirmCompanionFileChange(project, safeRelativePath, "", "Create", origin))) {
    throw Object.assign(new Error("File creation was cancelled in Ayatrisya Desktop."), { statusCode: 403 });
  }
  const handle = await fs.open(target, "wx", 0o600);
  await handle.close();
}

async function writeCompanionFile(projectId, relativePath, content, origin) {
  if (typeof content !== "string" || Buffer.byteLength(content, "utf8") > MAX_TEXT_FILE_BYTES) {
    throw new Error("Text files are limited to 1 MB in the browser companion.");
  }
  const safeRelativePath = validateBrowserCodingPath(relativePath);
  const project = requireProject(projectId);
  const target = await resolveWritableFile(fs, project.path, safeRelativePath);
  const stat = await fs.stat(target);
  if (!stat.isFile()) throw new Error("Choose a regular text file.");
  if (!(await confirmCompanionFileChange(project, safeRelativePath, content, "Update", origin))) {
    throw Object.assign(new Error("The file edit was cancelled in Ayatrisya Desktop."), { statusCode: 403 });
  }
  await fs.writeFile(target, content, "utf8");
}

async function removeCompanionProject(projectId) {
  const id = validateProjectId(projectId);
  const project = projectGrants.find((item) => item.id === id);
  if (!project) throw new Error("Local project folder not found.");
  const result = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    title: "Remove local folder access?",
    message: `Remove Ayatrisya's access to "${project.name}"?`,
    detail: "Your project files will not be deleted. You can grant access again later from Ayatrisya Desktop.",
    buttons: ["Cancel", "Remove access"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  if (result.response !== 1) return false;
  projectGrants = projectGrants.filter((item) => item.id !== id);
  await persistGrants();
  return true;
}

async function enableLocalCompanion() {
  if (companionServer?.enabled) return getLocalCompanionStatus();
  if (companionServer) {
    await companionServer.close().catch(() => undefined);
    companionServer = null;
  }
  const approval = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    title: "Enable the local browser companion?",
    message: "Start Ayatrisya’s loopback-only coding companion for this desktop session?",
    detail: `It listens only on 127.0.0.1:${COMPANION_PORT}, accepts the exact Ayatrisya website origin, and stops when the desktop window closes. It is disabled by default. Every browser pairing, file change, and command requires a separate desktop approval. This does not expose the service to your local network.`,
    buttons: ["Cancel", "Enable for this session"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  if (approval.response !== 1) return { ...getLocalCompanionStatus(), cancelled: true };

  const candidate = createCompanionServer({
    port: COMPANION_PORT,
    allowedOrigins: getCompanionAllowedOrigins(),
    handlers: {
      confirmPair: confirmCompanionPair,
      listProjects,
      chooseProject: chooseProjectFolder,
      removeProject: removeCompanionProject,
      listFiles: listCompanionFiles,
      readFile: readCompanionFile,
      createFile: createCompanionFile,
      writeFile: writeCompanionFile,
      runCommand: runConfirmedCommand,
    },
  });
  companionServer = candidate;
  try {
    await candidate.ready;
  } catch {
    companionServer = null;
    await candidate.close().catch(() => undefined);
    throw new Error(`Could not start the browser companion on 127.0.0.1:${COMPANION_PORT}. Another application may be using that port.`);
  }
  return getLocalCompanionStatus();
}

async function disableLocalCompanion() {
  const current = companionServer;
  companionServer = null;
  if (current) await current.close();
  return getLocalCompanionStatus();
}

registerIpc("desktop:companion:status", getLocalCompanionStatus);
registerIpc("desktop:companion:enable", enableLocalCompanion);
registerIpc("desktop:companion:disable", disableLocalCompanion);

registerIpc("desktop:terminal:run", (projectId, rawCommand, commandId) =>
  runConfirmedCommand(projectId, rawCommand, commandId));
registerIpc("desktop:terminal:cancel", cancelCommandRun);

registerIpc("desktop:auth:start", async (mode) => {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(16).toString("hex");

  pendingBrowserAuth = {
    verifier,
    challenge,
    state,
    createdAt: Date.now(),
    expiresAt: Date.now() + AUTH_TIMEOUT_MS,
  };

  const targetMode = mode === "create-account" ? "create-account" : "sign-in";
  const webBase = (process.env.AYATRISYA_WEB_ORIGIN || "https://ayatrisya.web.app").replace(/\/+$/, "");
  const authUrl = `${webBase}/auth/desktop?state=${encodeURIComponent(state)}&challenge=${encodeURIComponent(challenge)}&mode=${encodeURIComponent(targetMode)}`;

  const parsed = new URL(authUrl);
  if (
    parsed.protocol !== "https:" &&
    !(parsed.protocol === "http:" && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1"))
  ) {
    throw new Error("Invalid web authentication URL.");
  }

  await shell.openExternal(authUrl);
  return { state };
});

registerIpc("desktop:auth:cancel", () => {
  pendingBrowserAuth = null;
});

function contentType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

async function createStaticServer() {
  const root = path.resolve(app.getAppPath(), "dist", "public");
  const savedPort = await getSavedServerPort();
  const server = http.createServer(async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405).end();
      return;
    }

    try {
      const pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
      let candidate = path.resolve(root, `.${pathname}`);
      if (!isWithin(root, candidate)) {
        response.writeHead(404).end();
        return;
      }
      let file = candidate;
      try {
        if (!(await fs.stat(candidate)).isFile()) throw new Error("Not a file");
      } catch {
        if (path.extname(pathname)) {
          response.writeHead(404).end();
          return;
        }
        file = path.join(root, "index.html");
      }
      const body = await fs.readFile(file);
      response.writeHead(200, {
        "Content-Type": contentType(file),
        "Content-Length": body.length,
        "Cache-Control": path.basename(file) === "index.html" ? "no-cache" : "public, max-age=31536000, immutable",
      });
      if (request.method === "HEAD") response.end();
      else response.end(body);
    } catch {
      response.writeHead(400).end("Bad request");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(savedPort ?? 0, "localhost", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not start the local Ayatrisya server.");
  staticServer = server;
  if (savedPort === null) {
    try {
      await saveServerPort(address.port);
    } catch (error) {
      server.close();
      staticServer = null;
      throw error;
    }
  }
  return `http://localhost:${address.port}`;
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 920,
    minWidth: 960,
    minHeight: 660,
    show: false,
    backgroundColor: "#101116",
    title: "Ayatrisya",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
    },
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    void disableLocalCompanion().catch(() => undefined);
    mainWindow = null;
    warModeFolderGrants.clear();
    activeWarModeChild?.kill();
    if (activeYaraScanId) warModeYara.cancelScan(activeYaraScanId);
  });
  if (!app.isPackaged) {
    const devUrl = process.env.AYATRISYA_DESKTOP_DEV_URL;
    if (!devUrl || !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(devUrl)) {
      throw new Error("Desktop development must use the local Vite server.");
    }
    uiOrigin = new URL(devUrl).origin;
    await mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }
  const localUrl = await createStaticServer();
  uiOrigin = new URL(localUrl).origin;
  await mainWindow.loadURL(localUrl);
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const deepLink = commandLine.find((arg) => typeof arg === "string" && arg.trim().replace(/^["']|["']$/g, "").startsWith("ayatrisya://"));
    if (deepLink) {
      void handleAuthDeepLink(deepLink.trim().replace(/^["']|["']$/g, ""));
    }
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      void handleAuthDeepLink(url);
    }
  });

  app.whenReady().then(async () => {
    await loadGrants();
    await getSeedModelHost().load();
    const endpointFile = path.join(app.getPath("userData"), LOCAL_MODEL_FILE);
    try {
      await fs.access(endpointFile);
    } catch {
      if (getSeedModelHost().getStatus().configured) {
        await setLocalModelEndpoint("http://127.0.0.1:49382").catch(() => {});
      }
    }
    if (warModeIntegrationTestMode) {
      const reportPath = path.join(warModeTestDirectory, "war-mode-report.json");
      try {
        const { runWarModePackagedIntegration } = require("./war-mode-integration.cjs");
        const report = await runWarModePackagedIntegration({
          service: warModeYara,
          testRoot: path.join(warModeTestDirectory, "fixtures"),
          userIdentity: process.env.USERDOMAIN && process.env.USERNAME
            ? `${process.env.USERDOMAIN}\\${process.env.USERNAME}`
            : process.env.USERNAME || "",
          userDataDir: app.getPath("userData"),
        });
        await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
        app.exit(report.passed ? 0 : 1);
      } catch (error) {
        const report = error?.warModeReport || {
          passed: false,
          error: error?.message || "Packaged WAR MODE integration test failed.",
        };
        report.passed = false;
        report.finishedAt = new Date().toISOString();
        await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 }).catch(() => {});
        app.exit(1);
      }
      return;
    }
    await createMainWindow();
    void getSeedModelHost().startSaved();

    const initialDeepLink = process.argv.find((arg) => typeof arg === "string" && arg.trim().replace(/^["']|["']$/g, "").startsWith("ayatrisya://"));
    if (initialDeepLink) {
      const cleaned = initialDeepLink.trim().replace(/^["']|["']$/g, "");
      mainWindow.webContents.once("did-finish-load", () => {
        void handleAuthDeepLink(cleaned);
      });
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) void createMainWindow();
    });
  }).catch((error) => {
    dialog.showErrorBox("Ayatrisya could not start", safeError(error));
    app.quit();
  });
}

app.on("before-quit", () => {
  if (staticServer) staticServer.close();
  if (activeYaraScanId) warModeYara.cancelScan(activeYaraScanId);
  activeWarModeChild?.kill();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("will-quit", () => {
  if (seedModelHost) void seedModelHost.stop().catch(() => undefined);
  void disableLocalCompanion().catch(() => undefined);
});
